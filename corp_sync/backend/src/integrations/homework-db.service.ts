import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type HomeworkTableResponse = {
  status?: string;
  data?: Record<string, unknown>;
};

type HomeworkRowsResponse = {
  status?: string;
  data?: Array<{
    id: string;
    data: Record<string, unknown>;
  }>;
};

type HomeworkTableSchema = {
  name: string;
  columns: Array<{ name: string; type: 'string' | 'number' | 'boolean' }>;
};

type ClientRow = {
  id: string;
  client_type: 'individual' | 'company';
  name: string;
  email: string;
  phone: string;
  tax_identifier: string;
  address: string;
};

type InvoiceRow = {
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
};

@Injectable()
export class HomeworkDbService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configured = this.configService.get<string>('HOMEWORK_DB_BASE_URL');
    this.baseUrl = configured ?? 'http://localhost:3000';
  }

  private readonly clientsSchema: HomeworkTableSchema = {
    name: 'clients',
    columns: [
      { name: 'client_type', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'tax_identifier', type: 'string' },
      { name: 'address', type: 'string' },
    ],
  };

  private readonly invoicesSchema: HomeworkTableSchema = {
    name: 'invoices',
    columns: [
      { name: 'client_id', type: 'string' },
      { name: 'invoice_number', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'subtotal_amount', type: 'number' },
      { name: 'tax_amount', type: 'number' },
      { name: 'total_amount', type: 'number' },
      { name: 'currency', type: 'string' },
      { name: 'products_json', type: 'string' },
      { name: 'issue_date', type: 'string' },
      { name: 'due_date', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  };

  async tableExists(tableName: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/tables/${tableName}`),
      );
      return response.status === 200;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return false;
      }
      throw new ServiceUnavailableException(
        `Homework DB unavailable while checking table '${tableName}'`,
      );
    }
  }

  async createClientsTable(): Promise<void> {
    await this.createTable(this.clientsSchema);
  }

  async createInvoicesTable(): Promise<void> {
    await this.createTable(this.invoicesSchema);
  }

  async updateClientsTable(): Promise<void> {
    await this.updateTable(this.clientsSchema);
  }

  async updateInvoicesTable(): Promise<void> {
    await this.updateTable(this.invoicesSchema);
  }

  private async createTable(schema: HomeworkTableSchema): Promise<void> {
    try {
      await firstValueFrom(this.httpService.post(`${this.baseUrl}/tables`, schema));
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 409) {
        return;
      }
      throw new ServiceUnavailableException(
        `Failed to create '${schema.name}' table in Homework DB`,
      );
    }
  }

  private async updateTable(schema: HomeworkTableSchema): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/tables/${schema.name}`, schema),
      );
    } catch {
      throw new ServiceUnavailableException(
        `Failed to update '${schema.name}' table schema in Homework DB`,
      );
    }
  }

  async insertClient(client: Omit<ClientRow, 'id'>): Promise<{ rowId?: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/tables/clients/rows`, client),
      );
      return { rowId: (response.data as { id?: string }).id };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException("Table 'clients' not found in Homework DB");
      }
      if (axiosError.response?.status === 400) {
        throw new InternalServerErrorException(
          'Homework DB rejected client payload (schema mismatch or invalid data)',
        );
      }
      throw new ServiceUnavailableException('Homework DB unavailable while inserting client');
    }
  }

  async updateClient(clientId: string, client: Omit<ClientRow, 'id'>): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/tables/clients/rows/${clientId}`, client),
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Client '${clientId}' not found`);
      }
      if (axiosError.response?.status === 400) {
        throw new InternalServerErrorException('Homework DB rejected client update payload');
      }
      throw new ServiceUnavailableException('Homework DB unavailable while updating client');
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    try {
      await firstValueFrom(this.httpService.delete(`${this.baseUrl}/tables/clients/rows/${clientId}`));
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Client '${clientId}' not found`);
      }
      throw new ServiceUnavailableException('Homework DB unavailable while deleting client');
    }
  }

  async insertInvoice(invoice: Omit<InvoiceRow, 'id'>): Promise<{ rowId?: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/tables/invoices/rows`, invoice),
      );
      return { rowId: (response.data as { id?: string }).id };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException("Table 'invoices' not found in Homework DB");
      }
      if (axiosError.response?.status === 400) {
        throw new InternalServerErrorException(
          'Homework DB rejected invoice payload (schema mismatch or invalid data)',
        );
      }
      throw new ServiceUnavailableException('Homework DB unavailable while inserting invoice');
    }
  }

  async updateInvoice(invoiceId: string, invoice: Omit<InvoiceRow, 'id'>): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/tables/invoices/rows/${invoiceId}`, invoice),
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Invoice '${invoiceId}' not found`);
      }
      if (axiosError.response?.status === 400) {
        throw new InternalServerErrorException('Homework DB rejected invoice update payload');
      }
      throw new ServiceUnavailableException('Homework DB unavailable while updating invoice');
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.baseUrl}/tables/invoices/rows/${invoiceId}`),
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException(`Invoice '${invoiceId}' not found`);
      }
      throw new ServiceUnavailableException('Homework DB unavailable while deleting invoice');
    }
  }

  async getClientRows(): Promise<ClientRow[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HomeworkRowsResponse>(`${this.baseUrl}/tables/clients/rows`),
      );

      const rows = response.data.data ?? [];
      return rows.map((row) => {
        const payload = row.data as {
          client_type?: 'individual' | 'company';
          name?: string;
          email?: string;
          phone?: string;
          tax_identifier?: string;
          address?: string;
        };

        return {
          id: row.id,
          client_type: payload.client_type ?? 'individual',
          name: String(payload.name ?? ''),
          email: String(payload.email ?? ''),
          phone: String(payload.phone ?? ''),
          tax_identifier: String(payload.tax_identifier ?? ''),
          address: String(payload.address ?? ''),
        };
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException("Table 'clients' not found in Homework DB");
      }
      throw new ServiceUnavailableException('Homework DB unavailable while reading clients');
    }
  }

  async getClientById(clientId: string): Promise<ClientRow | null> {
    const clients = await this.getClientRows();
    return clients.find((client) => client.id === clientId) ?? null;
  }

  async getInvoiceRows(): Promise<InvoiceRow[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HomeworkRowsResponse>(`${this.baseUrl}/tables/invoices/rows`),
      );

      const rows = response.data.data ?? [];
      return rows.map((row) => {
        const payload = row.data as {
          client_id?: string;
          invoice_number?: string;
          description?: string;
          subtotal_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          products_json?: string;
          issue_date?: string;
          due_date?: string;
          status?: 'draft' | 'sent' | 'paid' | 'overdue';
        };

        return {
          id: row.id,
          client_id: String(payload.client_id ?? ''),
          invoice_number: String(payload.invoice_number ?? ''),
          description: String(payload.description ?? ''),
          subtotal_amount: Number(payload.subtotal_amount ?? 0),
          tax_amount: Number(payload.tax_amount ?? 0),
          total_amount: Number(payload.total_amount ?? 0),
          currency: String(payload.currency ?? '').toUpperCase(),
          products_json: String(payload.products_json ?? '[]'),
          issue_date: String(payload.issue_date ?? ''),
          due_date: String(payload.due_date ?? ''),
          status: payload.status ?? 'draft',
        };
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new NotFoundException("Table 'invoices' not found in Homework DB");
      }
      throw new ServiceUnavailableException('Homework DB unavailable while reading invoices');
    }
  }

  async getInvoiceById(invoiceId: string): Promise<InvoiceRow | null> {
    const invoices = await this.getInvoiceRows();
    return invoices.find((invoice) => invoice.id === invoiceId) ?? null;
  }

  async hasInvoicesForClient(clientId: string): Promise<boolean> {
    const invoices = await this.getInvoiceRows();
    return invoices.some((invoice) => invoice.client_id === clientId);
  }

  async getAllTablesRaw(): Promise<HomeworkTableResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HomeworkTableResponse>(`${this.baseUrl}/tables`),
      );
      return response.data;
    } catch {
      throw new ServiceUnavailableException('Homework DB unavailable while listing tables');
    }
  }
}
