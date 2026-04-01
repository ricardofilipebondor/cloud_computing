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

type InvoiceLine = {
  name: string;
  quantity: number;
  unit_price: number;
  vat_percent: number;
  currency: string;
  line_subtotal: number;
  line_tax: number;
  line_total: number;
  line_total_in_invoice_currency: number;
};

type InvoiceFinancials = {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  convertedTotals: Record<string, number>;
  normalizedProducts: InvoiceLine[];
};

const TARGET_CURRENCIES = ['RON', 'USD', 'EUR', 'GBP'];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly homeworkDbService: HomeworkDbService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  private ensureInvoiceExists<T>(invoice: T | null, invoiceId: string): T {
    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }
    return invoice;
  }

  private async ensureClientExists(clientId: string) {
    const client = await this.homeworkDbService.getClientById(clientId);
    if (!client) {
      throw new BadRequestException(`Client '${clientId}' does not exist`);
    }
    return client;
  }

  private ensureProductsExist(products: InvoiceProductDto[]): void {
    if (products.length === 0) {
      throw new BadRequestException('Invoice must include at least one product');
    }
  }

  private buildInvoicePayloadFromDto(dto: CreateInvoiceDto, financials: InvoiceFinancials): InvoicePayload {
    return {
      client_id: dto.clientId,
      invoice_number: dto.invoiceNumber,
      description: dto.description,
      subtotal_amount: financials.subtotalAmount,
      tax_amount: financials.taxAmount,
      total_amount: financials.totalAmount,
      currency: dto.currency.toUpperCase(),
      products_json: JSON.stringify(financials.normalizedProducts),
      issue_date: dto.issueDate,
      due_date: dto.dueDate,
      status: dto.status,
    };
  }

  private buildInvoiceUpdatePayload(existingInvoice: InvoicePayload & { [key: string]: string | number }, dto: UpdateInvoiceDto, clientId: string): InvoicePayload {
    return {
      client_id: clientId,
      invoice_number: dto.invoiceNumber ?? String(existingInvoice.invoice_number),
      description: dto.description ?? String(existingInvoice.description),
      subtotal_amount: 0,
      tax_amount: 0,
      total_amount: 0,
      currency: (dto.currency ?? String(existingInvoice.currency)).toUpperCase(),
      products_json: '',
      issue_date: dto.issueDate ?? String(existingInvoice.issue_date),
      due_date: dto.dueDate ?? String(existingInvoice.due_date),
      status: (dto.status ?? existingInvoice.status) as InvoicePayload['status'],
    };
  }

  private async buildInvoiceFinancials(
    products: InvoiceProductDto[],
    invoiceCurrency: string,
  ): Promise<InvoiceFinancials> {
    const ratesCache = new Map<string, Record<string, number>>();
    const invoiceCurrencyNormalized = invoiceCurrency.toUpperCase();
    let subtotalAmount = 0;
    let taxAmount = 0;

    const normalizedProducts = await Promise.all(
      products.map(async (product) => {
        const currency = product.currency.toUpperCase();
        const lineSubtotal = Number((product.unitPrice * product.quantity).toFixed(2));
        const lineTax = Number((lineSubtotal * (product.vatPercent / 100)).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        const normalizedFrom = currency;
        const normalizedTo = invoiceCurrencyNormalized;

        let lineSubtotalInInvoiceCurrency: number;
        let lineTaxInInvoiceCurrency: number;
        let lineTotalInInvoiceCurrency: number;

        if (normalizedFrom === normalizedTo) {
          // Dacă moneda produsului e aceeași cu moneda facturii, nu facem conversie,
          // dar păstrăm aceeași rotunjire la 2 zecimale ca înainte.
          lineSubtotalInInvoiceCurrency = Number(lineSubtotal.toFixed(2));
          lineTaxInInvoiceCurrency = Number(lineTax.toFixed(2));
          lineTotalInInvoiceCurrency = Number(lineTotal.toFixed(2));
        } else {
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

          lineSubtotalInInvoiceCurrency = Number((lineSubtotal * rate).toFixed(2));
          lineTaxInInvoiceCurrency = Number((lineTax * rate).toFixed(2));
          lineTotalInInvoiceCurrency = Number((lineTotal * rate).toFixed(2));
        }

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
      invoiceCurrencyNormalized,
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
    const client = await this.ensureClientExists(dto.clientId);
    const financials = await this.buildInvoiceFinancials(dto.products, dto.currency.toUpperCase());
    const payload = this.buildInvoicePayloadFromDto(dto, financials);

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

    const existingInvoice = this.ensureInvoiceExists(invoice, invoiceId);

    const linkedClient = client.find((row) => row.id === existingInvoice.client_id);

    return {
      status: 'ok',
      data: await this.enrichInvoice(
        existingInvoice,
        linkedClient?.name ?? null,
        linkedClient?.email ?? null,
      ),
    };
  }

  async updateInvoice(invoiceId: string, dto: UpdateInvoiceDto) {
    const existingInvoice = this.ensureInvoiceExists(
      await this.homeworkDbService.getInvoiceById(invoiceId),
      invoiceId,
    );

    const nextClientId = dto.clientId ?? existingInvoice.client_id;
    const client = await this.ensureClientExists(nextClientId);
    const payload = this.buildInvoiceUpdatePayload(existingInvoice, dto, nextClientId);

    const products = dto.products ?? this.parseInvoiceProducts(existingInvoice.products_json);
    this.ensureProductsExist(products);

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
    this.ensureInvoiceExists(await this.homeworkDbService.getInvoiceById(invoiceId), invoiceId);
    await this.homeworkDbService.deleteInvoice(invoiceId);
    return {
      status: 'ok',
      message: 'Invoice deleted successfully',
    };
  }
}
