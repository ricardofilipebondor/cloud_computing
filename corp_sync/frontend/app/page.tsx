'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClientForm } from '../components/ClientForm';
import { ClientsTable } from '../components/ClientsTable';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicesTable } from '../components/InvoicesTable';
import { Client, Invoice } from '../components/types';

type ApiResponse<T> = { data?: T[]; message?: string };

export default function HomePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

  const loadDashboard = useCallback(async (): Promise<void> => {
    setLoading(true);
    setClientsError(null);
    setInvoicesError(null);

    try {
      const [clientsResponse, invoicesResponse] = await Promise.all([
        fetch(`${backendUrl}/clients`, { cache: 'no-store' }),
        fetch(`${backendUrl}/invoices`, { cache: 'no-store' }),
      ]);
      const clientsPayload = (await clientsResponse.json()) as ApiResponse<Client>;
      const invoicesPayload = (await invoicesResponse.json()) as ApiResponse<Invoice>;

      if (!clientsResponse.ok) {
        setClientsError(clientsPayload.message ?? 'Failed to load clients');
      }
      if (!invoicesResponse.ok) {
        setInvoicesError(invoicesPayload.message ?? 'Failed to load invoices');
      }

      if (clientsResponse.ok) {
        setClients(clientsPayload.data ?? []);
      }
      if (invoicesResponse.ok) {
        setInvoices(invoicesPayload.data ?? []);
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Unable to load dashboard data.';
      setClientsError(fallback);
      setInvoicesError(fallback);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const deleteClient = useCallback(
    async (clientId: string): Promise<void> => {
      const response = await fetch(`${backendUrl}/clients/${clientId}`, { method: 'DELETE' });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not delete client');
      }
      if (editingClient?.id === clientId) {
        setEditingClient(null);
      }
      if (selectedClientId === clientId) {
        setSelectedClientId(null);
      }
      await loadDashboard();
    },
    [backendUrl, editingClient?.id, loadDashboard, selectedClientId],
  );

  const deleteInvoice = useCallback(
    async (invoiceId: string): Promise<void> => {
      const response = await fetch(`${backendUrl}/invoices/${invoiceId}`, { method: 'DELETE' });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not delete invoice');
      }
      if (editingInvoice?.id === invoiceId) {
        setEditingInvoice(null);
      }
      await loadDashboard();
    },
    [backendUrl, editingInvoice?.id, loadDashboard],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredInvoices = selectedClientId
    ? invoices.filter((invoice) => invoice.client_id === selectedClientId)
    : invoices;
  const selectedClientName =
    clients.find((client) => client.id === selectedClientId)?.name ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6 md:p-10">
      <header className="mb-8 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-md">
        <h1 className="text-3xl font-bold">CorpSync CRM</h1>
        <p className="mt-2 text-sm text-slate-200">
          Professional client and invoice administration with email validation and live currency
          conversion.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <ClientForm
          onSaved={loadDashboard}
          editingClient={editingClient}
          onCancelEdit={() => setEditingClient(null)}
        />
        <InvoiceForm
          clients={clients}
          onSaved={loadDashboard}
          editingInvoice={editingInvoice}
          onCancelEdit={() => setEditingInvoice(null)}
          selectedClientId={selectedClientId}
        />
      </div>

      <div className="mt-6 space-y-6">
        <ClientsTable
          clients={clients}
          loading={loading}
          error={clientsError}
          onEdit={setEditingClient}
          onDelete={deleteClient}
          onSelect={setSelectedClientId}
          selectedClientId={selectedClientId}
        />
        <InvoicesTable
          invoices={filteredInvoices}
          loading={loading}
          error={invoicesError}
          onEdit={setEditingInvoice}
          onDelete={deleteInvoice}
          selectedClientName={selectedClientName}
          onClearClientFilter={() => setSelectedClientId(null)}
        />
      </div>
    </main>
  );
}
