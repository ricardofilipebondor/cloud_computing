import { Client } from './types';

type Props = {
  clients: Client[];
  loading: boolean;
  error: string | null;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => Promise<void>;
  onSelect: (clientId: string | null) => void;
  selectedClientId: string | null;
};

export function ClientsTable({
  clients,
  loading,
  error,
  onEdit,
  onDelete,
  onSelect,
  selectedClientId,
}: Props) {
  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6">Loading clients...</section>;
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error}</section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Clients</h2>
        <span className="text-sm text-slate-500">{clients.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-3">Type</th>
              <th className="px-2 py-3">Name</th>
              <th className="px-2 py-3">Email</th>
              <th className="px-2 py-3">Phone</th>
              <th className="px-2 py-3">Identifier</th>
              <th className="px-2 py-3">Address</th>
              <th className="px-2 py-3">Invoices</th>
              <th className="px-2 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                className={`border-b border-slate-100 ${selectedClientId === client.id ? 'bg-slate-50' : ''}`}
              >
                <td className="px-2 py-3">{client.client_type}</td>
                <td className="px-2 py-3 font-medium text-slate-800">{client.name}</td>
                <td className="px-2 py-3">{client.email}</td>
                <td className="px-2 py-3">{client.phone}</td>
                <td className="px-2 py-3">{client.tax_identifier}</td>
                <td className="px-2 py-3">{client.address}</td>
                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(selectedClientId === client.id ? null : client.id)}
                    className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                  >
                    {selectedClientId === client.id ? 'Hide invoices' : 'Open invoices'}
                  </button>
                </td>
                <td className="px-2 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(client)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(client.id)}
                      className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td className="px-2 py-4 text-slate-500" colSpan={8}>
                  No clients found. Add your first client to start using CRM.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
