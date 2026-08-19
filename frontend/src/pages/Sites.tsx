import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerApi, siteApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { SiteRequest } from '../api/types';
import { Button, Card, EmptyState, Input, Modal, Select, Spinner } from '../components/ui';

const emptyForm: SiteRequest = {
  customerId: 0,
  name: '',
  streetAddress: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  contactName: '',
  contactPhone: '',
  notes: '',
};

export default function Sites() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'MANAGER';
  const [filterCustomer, setFilterCustomer] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const [form, setForm] = useState<SiteRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const customers = useQuery({ queryKey: ['customers'], queryFn: () => customerApi.list({ size: 100 }) });
  const sites = useQuery({
    queryKey: ['sites', filterCustomer],
    queryFn: () => siteApi.list({ customerId: filterCustomer ? Number(filterCustomer) : undefined }),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error('Modal not open');
      return modal.mode === 'create'
        ? siteApi.create(form)
        : siteApi.update(modal.id, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      setModal(null);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => siteApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const openCreate = () => {
    setForm({
      ...emptyForm,
      customerId: filterCustomer ? Number(filterCustomer) : 0,
    });
    setError(null);
    setModal({ mode: 'create' });
  };
  const openEdit = (s: { id: number; customerId: number; name: string; streetAddress: string; city: string; state: string; zip: string; country: string; contactName?: string; contactPhone?: string; notes?: string }) => {
    setForm({
      customerId: s.customerId,
      name: s.name,
      streetAddress: s.streetAddress,
      city: s.city,
      state: s.state,
      zip: s.zip,
      country: s.country,
      contactName: s.contactName,
      contactPhone: s.contactPhone,
      notes: s.notes,
    });
    setError(null);
    setModal({ mode: 'edit', id: s.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Sites</h1>
        {canEdit && <Button onClick={openCreate}>+ New Site</Button>}
      </div>

      <div className="w-64">
        <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
          <option value="">All customers</option>
          {customers.data?.content.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {sites.isLoading ? (
        <Spinner />
      ) : sites.isError || !sites.data || sites.data.length === 0 ? (
        <EmptyState message="No sites found." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.data.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.customerName}</div>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button variant="ghost" onClick={() => openEdit(s)}>Edit</Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm('Delete this site?')) remove.mutate(s.id); }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.fullAddress}</p>
              {s.contactName && (
                <p className="mt-1 text-xs text-slate-400">
                  {s.contactName}{s.contactPhone ? ` · ${s.contactPhone}` : ''}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'New Site' : 'Edit Site'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.name || !form.customerId || !form.city}>
              Save
            </Button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Customer" value={form.customerId || ''} onChange={(e) => setForm({ ...form, customerId: Number(e.target.value) })}>
            <option value="">Select customer...</option>
            {customers.data?.content.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input label="Site name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Street address" value={form.streetAddress} onChange={(e) => setForm({ ...form, streetAddress: e.target.value })} />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          <Input label="State / Province" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="ZIP / Postal code" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Input label="On-site contact" value={form.contactName ?? ''} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <Input label="Contact phone" value={form.contactPhone ?? ''} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <Input label="Notes" className="sm:col-span-2" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
