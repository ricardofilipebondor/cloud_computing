import { Invoice } from './types';

type Props = {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoiceId: string) => Promise<void>;
  selectedClientName: string | null;
  onClearClientFilter: () => void;
};

export function InvoicesTable({
  invoices,
  loading,
  error,
  onEdit,
  onDelete,
  selectedClientName,
  onClearClientFilter,
}: Props) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">Loading invoices...</section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error}</section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
          {selectedClientName && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              Client: {selectedClientName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{invoices.length} records</span>
          {selectedClientName && (
            <button
              type="button"
              onClick={onClearClientFilter}
              className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              Show all
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-3">Invoice #</th>
              <th className="px-2 py-3">Client</th>
              <th className="px-2 py-3">Description</th>
              <th className="px-2 py-3">Products</th>
              <th className="px-2 py-3">Amount</th>
              <th className="px-2 py-3">Converted</th>
              <th className="px-2 py-3">Issue / Due</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-3 font-medium text-slate-800">{invoice.invoice_number}</td>
                <td className="px-2 py-3">
                  <div>{invoice.client_name ?? 'Unknown client'}</div>
                  <div className="text-xs text-slate-500">{invoice.client_email ?? '-'}</div>
                </td>
                <td className="px-2 py-3">{invoice.description}</td>
                <td className="px-2 py-3 text-xs text-slate-600">
                  <div className="space-y-1">
                    {invoice.products.map((product, index) => (
                      <div key={`${invoice.id}-${index}`}>
                        {product.name} x{product.quantity} @ {product.unit_price.toFixed(2)}{' '}
                        {product.currency} (TVA {product.vat_percent}%)
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div>Total: {invoice.total_amount.toFixed(2)} {invoice.currency}</div>
                  <div className="text-xs text-slate-500">
                    Net: {invoice.subtotal_amount.toFixed(2)} / TVA: {invoice.tax_amount.toFixed(2)}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="space-y-1 text-xs text-slate-600">
                    {Object.entries(invoice.converted_amounts).map(([currency, value]) => (
                      <div key={currency}>
                        {currency}: {value.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-3 text-xs text-slate-600">
                  <div>Issue: {invoice.issue_date}</div>
                  <div>Due: {invoice.due_date}</div>
                </td>
                <td className="px-2 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {invoice.status}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(invoice)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(invoice.id)}
                      className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td className="px-2 py-4 text-slate-500" colSpan={9}>
                  No invoices found. Create one after adding clients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
