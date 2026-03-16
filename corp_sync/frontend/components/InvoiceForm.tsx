'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Client, Currency, Invoice, InvoiceProduct, InvoiceStatus } from './types';

type Props = {
  clients: Client[];
  onSaved: () => Promise<void>;
  editingInvoice: Invoice | null;
  onCancelEdit: () => void;
  selectedClientId: string | null;
};

type InvoicePayload = {
  clientId: string;
  invoiceNumber: string;
  description: string;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  products: InvoiceProductInput[];
};

type InvoiceProductInput = {
  name: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
  currency: Currency;
};

const emptyProduct = (): InvoiceProductInput => ({
  name: '',
  quantity: '1',
  unitPrice: '',
  vatPercent: '19',
  currency: 'RON',
});

const DEFAULT_PAYLOAD: InvoicePayload = {
  clientId: '',
  invoiceNumber: '',
  description: '',
  currency: 'RON',
  issueDate: '',
  dueDate: '',
  status: 'draft',
  products: [emptyProduct()],
};

export function InvoiceForm({
  clients,
  onSaved,
  editingInvoice,
  onCancelEdit,
  selectedClientId,
}: Props) {
  const [form, setForm] = useState<InvoicePayload>(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

  const normalizeProductsForPayload = (products: InvoiceProductInput[]) =>
    products.map((product) => ({
      name: product.name,
      quantity: Number(product.quantity),
      unitPrice: Number(product.unitPrice),
      vatPercent: Number(product.vatPercent),
      currency: product.currency,
    }));

  const mapProductForForm = (product: InvoiceProduct): InvoiceProductInput => ({
    name: product.name,
    quantity: String(product.quantity),
    unitPrice: String(product.unit_price),
    vatPercent: String(product.vat_percent),
    currency: product.currency,
  });

  useEffect(() => {
    if (!editingInvoice) {
      setForm((prev) => ({
        ...DEFAULT_PAYLOAD,
        clientId: selectedClientId ?? prev.clientId ?? '',
      }));
      return;
    }
    setForm({
      clientId: editingInvoice.client_id,
      invoiceNumber: editingInvoice.invoice_number,
      description: editingInvoice.description,
      currency: editingInvoice.currency,
      issueDate: editingInvoice.issue_date,
      dueDate: editingInvoice.due_date,
      status: editingInvoice.status,
      products:
        editingInvoice.products.length > 0
          ? editingInvoice.products.map(mapProductForForm)
          : [emptyProduct()],
    });
  }, [editingInvoice, selectedClientId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isEdit = Boolean(editingInvoice);
      const endpoint = isEdit
        ? `${backendUrl}/invoices/${editingInvoice?.id}`
        : `${backendUrl}/invoices`;
      const method = isEdit ? 'PUT' : 'POST';
      const payload = {
        clientId: form.clientId,
        invoiceNumber: form.invoiceNumber,
        description: form.description,
        currency: form.currency,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        products: normalizeProductsForPayload(form.products),
      };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(body.message ?? 'Could not save invoice');
      }

      setSuccess(isEdit ? 'Invoice updated.' : 'Invoice created.');
      if (!isEdit) {
        setForm(DEFAULT_PAYLOAD);
      }
      await onSaved();
      if (isEdit) {
        onCancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingInvoice ? 'Edit Invoice' : 'Create Invoice'}
        </h2>
        {editingInvoice && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Cancel edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
        <select
          value={form.clientId}
          onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.client_type})
            </option>
          ))}
        </select>
        <input
          value={form.invoiceNumber}
          onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
          placeholder="Invoice number"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Description"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <select
          value={form.currency}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, currency: e.target.value as Currency }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="RON">RON</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
        <select
          value={form.status}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, status: e.target.value as InvoiceStatus }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <input
          type="date"
          value={form.issueDate}
          onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />

        <div className="md:col-span-2 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Products</h3>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({ ...prev, products: [...prev.products, emptyProduct()] }))
              }
              className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              + Add product
            </button>
          </div>
          <div className="space-y-2">
            {form.products.map((product, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-6">
                <input
                  value={product.name}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = [...prev.products];
                      next[index] = { ...next[index], name: e.target.value };
                      return { ...prev, products: next };
                    })
                  }
                  placeholder="Product name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={product.quantity}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = [...prev.products];
                      next[index] = { ...next[index], quantity: e.target.value };
                      return { ...prev, products: next };
                    })
                  }
                  placeholder="Qty"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={product.unitPrice}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = [...prev.products];
                      next[index] = { ...next[index], unitPrice: e.target.value };
                      return { ...prev, products: next };
                    })
                  }
                  placeholder="Unit price"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={product.vatPercent}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = [...prev.products];
                      next[index] = { ...next[index], vatPercent: e.target.value };
                      return { ...prev, products: next };
                    })
                  }
                  placeholder="VAT %"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <select
                  value={product.currency}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = [...prev.products];
                      next[index] = { ...next[index], currency: e.target.value as Currency };
                      return { ...prev, products: next };
                    })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="RON">RON</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => {
                      if (prev.products.length === 1) {
                        return prev;
                      }
                      const next = prev.products.filter((_, i) => i !== index);
                      return { ...prev, products: next };
                    })
                  }
                  className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {loading ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Save Invoice'}
          </button>
          {success && <p className="text-sm text-emerald-700">{success}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
