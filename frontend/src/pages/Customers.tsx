import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { CustomerRequest } from '../api/types';
import { Badge, Button, Card, EmptyState, Input, Modal, Pagination, Spinner } from '../components/ui';

const emptyForm: CustomerRequest = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  createPortalUser: false,
  portalUsername: '',
  portalPassword: '',
};

export default function Customers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'MANAGER';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const [form, setForm] = useState<CustomerRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => customerApi.list({ search: search || undefined, page, size: 12 }),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error('Modal not open');
      return modal.mode === 'create'
        ? customerApi.create(form)
        : customerApi.update(modal.id, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setModal(null);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customerApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setModal({ mode: 'create' });
  };
  const openEdit = (c: { id: number; name: string; contactName: string; email: string; phone?: string; address?: string }) => {
    setForm({
      name: c.name,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      address: c.address,
      createPortalUser: false,
      portalUsername: '',
      portalPassword: '',
    });
    setError(null);
    setModal({ mode: 'edit', id: c.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Customers</h1>
        {canEdit && <Button onClick={openCreate}>+ New Customer</Button>}
      </div>

      <div className="w-64">
        <Input placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : query.isError || !query.data || query.data.content.length === 0 ? (
        <EmptyState message="No customers found." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Portal</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.content.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.contactName}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.portalUsername ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{c.portalUsername}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <Button variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Delete ${c.name}? This may fail if it has sites or work orders.`)) remove.mutate(c.id); }}>
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />
          </div>
        </Card>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'New Customer' : 'Edit Customer'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.name || !form.contactName || !form.email}>
              Save
            </Button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <Input label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {modal?.mode === 'create' && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.createPortalUser ?? false}
                  onChange={(e) => setForm({ ...form, createPortalUser: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Create a customer portal login
              </label>
              {form.createPortalUser && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Portal username" value={form.portalUsername ?? ''} onChange={(e) => setForm({ ...form, portalUsername: e.target.value })} />
                  <Input label="Portal password" type="password" value={form.portalPassword ?? ''} onChange={(e) => setForm({ ...form, portalPassword: e.target.value })} />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
