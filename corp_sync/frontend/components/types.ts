export type ClientType = 'individual' | 'company';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type Currency = 'RON' | 'USD' | 'EUR' | 'GBP';

export type Client = {
  id: string;
  client_type: ClientType;
  name: string;
  email: string;
  phone: string;
  tax_identifier: string;
  address: string;
};

export type Invoice = {
  id: string;
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  invoice_number: string;
  description: string;
  amount: number;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: Currency;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  products: InvoiceProduct[];
  converted_amounts: Record<string, number>;
};

export type InvoiceProduct = {
  name: string;
  quantity: number;
  unit_price: number;
  vat_percent: number;
  currency: Currency;
  line_subtotal: number;
  line_tax: number;
  line_total: number;
  line_total_in_invoice_currency: number;
};
