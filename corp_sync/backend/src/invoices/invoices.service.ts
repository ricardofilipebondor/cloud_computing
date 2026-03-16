import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExchangeRateService } from '../integrations/exchange-rate.service';
import { HomeworkDbService } from '../integrations/homework-db.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceProductDto } from './dto/invoice-product.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

type InvoicePayload = {
  client_id: string;
  invoice_number: string;
  description: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  products_json: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
};

const TARGET_CURRENCIES = ['RON', 'USD', 'EUR', 'GBP'];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly homeworkDbService: HomeworkDbService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  private async convertAmountBetweenCurrencies(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    ratesCache: Map<string, Record<string, number>>,
  ): Promise<number> {
    const normalizedFrom = fromCurrency.toUpperCase();
    const normalizedTo = toCurrency.toUpperCase();
    if (normalizedFrom === normalizedTo) {
      return Number(amount.toFixed(2));
    }

    if (!ratesCache.has(normalizedFrom)) {
      const rates = await this.exchangeRateService.getRates(normalizedFrom);
      ratesCache.set(normalizedFrom, rates.rates);
    }

    const fromRates = ratesCache.get(normalizedFrom);
    const rate = fromRates?.[normalizedTo];
    if (!rate) {
      throw new BadRequestException(
        `Currency conversion not available from ${normalizedFrom} to ${normalizedTo}`,
      );
    }
    return Number((amount * rate).toFixed(2));
  }

  private async buildInvoiceFinancials(
    products: InvoiceProductDto[],
    invoiceCurrency: string,
  ): Promise<{
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    convertedTotals: Record<string, number>;
    normalizedProducts: Array<{
      name: string;
      quantity: number;
      unit_price: number;
      vat_percent: number;
      currency: string;
      line_subtotal: number;
      line_tax: number;
      line_total: number;
      line_total_in_invoice_currency: number;
    }>;
  }> {
    const ratesCache = new Map<string, Record<string, number>>();
    let subtotalAmount = 0;
    let taxAmount = 0;

    const normalizedProducts = await Promise.all(
      products.map(async (product) => {
        const currency = product.currency.toUpperCase();
        const lineSubtotal = Number((product.unitPrice * product.quantity).toFixed(2));
        const lineTax = Number((lineSubtotal * (product.vatPercent / 100)).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        const lineSubtotalInInvoiceCurrency = await this.convertAmountBetweenCurrencies(
          lineSubtotal,
          currency,
          invoiceCurrency,
          ratesCache,
        );
        const lineTaxInInvoiceCurrency = await this.convertAmountBetweenCurrencies(
          lineTax,
          currency,
          invoiceCurrency,
          ratesCache,
        );
        const lineTotalInInvoiceCurrency = await this.convertAmountBetweenCurrencies(
          lineTotal,
          currency,
          invoiceCurrency,
          ratesCache,
        );

        subtotalAmount = Number((subtotalAmount + lineSubtotalInInvoiceCurrency).toFixed(2));
        taxAmount = Number((taxAmount + lineTaxInInvoiceCurrency).toFixed(2));

        return {
          name: product.name,
          quantity: product.quantity,
          unit_price: Number(product.unitPrice.toFixed(2)),
          vat_percent: Number(product.vatPercent.toFixed(2)),
          currency,
          line_subtotal: lineSubtotal,
          line_tax: lineTax,
          line_total: lineTotal,
          line_total_in_invoice_currency: lineTotalInInvoiceCurrency,
        };
      }),
    );

    const totalAmount = Number((subtotalAmount + taxAmount).toFixed(2));
    const convertedTotals = await this.exchangeRateService.convertAmount(
      totalAmount,
      invoiceCurrency,
      TARGET_CURRENCIES,
    );

    return {
      subtotalAmount,
      taxAmount,
      totalAmount,
      convertedTotals,
      normalizedProducts,
    };
  }

  private parseInvoiceProducts(productsJson: string): InvoiceProductDto[] {
    try {
      const parsed = JSON.parse(productsJson) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const value = item as Record<string, unknown>;
          return {
            name: String(value.name ?? ''),
            quantity: Number(value.quantity ?? 0),
            unitPrice: Number(value.unit_price ?? value.unitPrice ?? 0),
            vatPercent: Number(value.vat_percent ?? value.vatPercent ?? 0),
            currency: String(value.currency ?? 'RON').toUpperCase() as
              | 'RON'
              | 'USD'
              | 'EUR'
              | 'GBP',
          };
        })
        .filter((product) => product.name && product.quantity > 0 && product.unitPrice > 0);
    } catch {
      return [];
    }
  }

  private async enrichInvoice(
    invoice: {
      id: string;
      client_id: string;
      invoice_number: string;
      description: string;
      subtotal_amount: number;
      tax_amount: number;
      total_amount: number;
      currency: string;
      products_json: string;
      issue_date: string;
      due_date: string;
      status: 'draft' | 'sent' | 'paid' | 'overdue';
    },
    clientName: string | null,
    clientEmail: string | null,
  ) {
    const parsedProducts = this.parseInvoiceProducts(invoice.products_json);
    const financials = await this.buildInvoiceFinancials(parsedProducts, invoice.currency);
    return {
      ...invoice,
      products: financials.normalizedProducts,
      client_name: clientName,
      client_email: clientEmail,
      converted_amounts: financials.convertedTotals,
      subtotal_amount: financials.subtotalAmount,
      tax_amount: financials.taxAmount,
      total_amount: financials.totalAmount,
      amount: financials.totalAmount,
    };
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const client = await this.homeworkDbService.getClientById(dto.clientId);
    if (!client) {
      throw new BadRequestException(`Client '${dto.clientId}' does not exist`);
    }

    const invoiceCurrency = dto.currency.toUpperCase();
    const financials = await this.buildInvoiceFinancials(dto.products, invoiceCurrency);

    const payload: InvoicePayload = {
      client_id: dto.clientId,
      invoice_number: dto.invoiceNumber,
      description: dto.description,
      subtotal_amount: financials.subtotalAmount,
      tax_amount: financials.taxAmount,
      total_amount: financials.totalAmount,
      currency: invoiceCurrency,
      products_json: JSON.stringify(financials.normalizedProducts),
      issue_date: dto.issueDate,
      due_date: dto.dueDate,
      status: dto.status,
    };

    const created = await this.homeworkDbService.insertInvoice(payload);

    return {
      status: 'ok',
      message: 'Invoice created successfully',
      data: {
        id: created.rowId,
        ...payload,
        products: financials.normalizedProducts,
        client_name: client.name,
        converted_amounts: financials.convertedTotals,
        amount: financials.totalAmount,
      },
    };
  }

  async getInvoices() {
    const [invoices, clients] = await Promise.all([
      this.homeworkDbService.getInvoiceRows(),
      this.homeworkDbService.getClientRows(),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));

    const data = await Promise.all(
      invoices.map(async (invoice) => {
        const client = clientsById.get(invoice.client_id);

        return this.enrichInvoice(invoice, client?.name ?? null, client?.email ?? null);
      }),
    );

    return {
      status: 'ok',
      count: data.length,
      data,
    };
  }

  async getInvoiceById(invoiceId: string) {
    const [invoice, client] = await Promise.all([
      this.homeworkDbService.getInvoiceById(invoiceId),
      this.homeworkDbService.getClientRows(),
    ]);

    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    const linkedClient = client.find((row) => row.id === invoice.client_id);

    return {
      status: 'ok',
      data: await this.enrichInvoice(invoice, linkedClient?.name ?? null, linkedClient?.email ?? null),
    };
  }

  async updateInvoice(invoiceId: string, dto: UpdateInvoiceDto) {
    const existingInvoice = await this.homeworkDbService.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    const nextClientId = dto.clientId ?? existingInvoice.client_id;
    const client = await this.homeworkDbService.getClientById(nextClientId);
    if (!client) {
      throw new BadRequestException(`Client '${nextClientId}' does not exist`);
    }

    const payload: InvoicePayload = {
      client_id: nextClientId,
      invoice_number: dto.invoiceNumber ?? existingInvoice.invoice_number,
      description: dto.description ?? existingInvoice.description,
      subtotal_amount: 0,
      tax_amount: 0,
      total_amount: 0,
      currency: (dto.currency ?? existingInvoice.currency).toUpperCase(),
      products_json: '',
      issue_date: dto.issueDate ?? existingInvoice.issue_date,
      due_date: dto.dueDate ?? existingInvoice.due_date,
      status: dto.status ?? existingInvoice.status,
    };

    const products =
      dto.products ?? this.parseInvoiceProducts(existingInvoice.products_json);
    if (products.length === 0) {
      throw new BadRequestException('Invoice must include at least one product');
    }

    const financials = await this.buildInvoiceFinancials(products, payload.currency);
    payload.subtotal_amount = financials.subtotalAmount;
    payload.tax_amount = financials.taxAmount;
    payload.total_amount = financials.totalAmount;
    payload.products_json = JSON.stringify(financials.normalizedProducts);

    await this.homeworkDbService.updateInvoice(invoiceId, payload);

    return {
      status: 'ok',
      message: 'Invoice updated successfully',
      data: {
        id: invoiceId,
        ...payload,
        client_name: client.name,
        products: financials.normalizedProducts,
        converted_amounts: financials.convertedTotals,
        amount: financials.totalAmount,
      },
    };
  }

  async deleteInvoice(invoiceId: string) {
    const existingInvoice = await this.homeworkDbService.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }
    await this.homeworkDbService.deleteInvoice(invoiceId);
    return {
      status: 'ok',
      message: 'Invoice deleted successfully',
    };
  }
}
