'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Client, ClientType } from './types';

type Props = {
  onSaved: () => Promise<void>;
  editingClient: Client | null;
  onCancelEdit: () => void;
};

type ClientPayload = {
  clientType: ClientType;
  name: string;
  email: string;
  phone: string;
  taxIdentifier: string;
  address: string;
};

const DEFAULT_PAYLOAD: ClientPayload = {
  clientType: 'individual',
  name: '',
  email: '',
  phone: '',
  taxIdentifier: '',
  address: '',
};

export function ClientForm({ onSaved, editingClient, onCancelEdit }: Props) {
  const [form, setForm] = useState<ClientPayload>(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

  useEffect(() => {
    if (!editingClient) {
      setForm(DEFAULT_PAYLOAD);
      return;
    }

    setForm({
      clientType: editingClient.client_type,
      name: editingClient.name,
      email: editingClient.email,
      phone: editingClient.phone,
      taxIdentifier: editingClient.tax_identifier,
      address: editingClient.address,
    });
  }, [editingClient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isEdit = Boolean(editingClient);
      const endpoint = isEdit
        ? `${backendUrl}/clients/${editingClient?.id}`
        : `${backendUrl}/clients`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not save client');
      }

      setSuccess(isEdit ? 'Client updated.' : 'Client created.');
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
          {editingClient ? 'Edit Client' : 'Create Client'}
        </h2>
        {editingClient && (
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
          value={form.clientType}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, clientType: e.target.value as ClientType }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        >
          <option value="individual">Individual</option>
          <option value="company">Company</option>
        </select>
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Client name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="Phone"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={form.taxIdentifier}
          onChange={(e) => setForm((prev) => ({ ...prev, taxIdentifier: e.target.value }))}
          placeholder={form.clientType === 'company' ? 'CUI / VAT number' : 'Personal identifier'}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          value={form.address}
          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="Address"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <div className="md:col-span-2 flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {loading ? 'Saving...' : editingClient ? 'Update Client' : 'Save Client'}
          </button>
          {success && <p className="text-sm text-emerald-700">{success}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
