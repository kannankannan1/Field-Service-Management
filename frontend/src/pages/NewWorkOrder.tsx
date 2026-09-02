import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerApi, siteApi, workOrderApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Input, Select, Textarea } from '../components/ui';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '../lib/labels';

export default function NewWorkOrder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  const isCustomer = user?.role === 'CUSTOMER';
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.list({ size: 100 }),
  });
  const sites = useQuery({
    queryKey: ['sites', customerId],
    queryFn: () => siteApi.list({ customerId: customerId ? Number(customerId) : undefined }),
    enabled: !!customerId,
  });

  useEffect(() => {
    setSiteId('');
  }, [customerId]);

  useEffect(() => {
    if (isCustomer && !customerId && customers.data?.content.length) {
      setCustomerId(String(customers.data.content[0].id));
    }
  }, [isCustomer, customerId, customers.data]);

  useEffect(() => {
    if (isCustomer && !siteId && sites.data?.content.length) {
      setSiteId(String(sites.data.content[0].id));
    }
  }, [isCustomer, siteId, sites.data]);

  const create = useMutation({
    mutationFn: () =>
      workOrderApi.create({
        customerId: Number(customerId),
        siteId: Number(siteId),
        title,
        description: description || undefined,
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
      }),
    onSuccess: (wo) => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      navigate(`/work-orders/${wo.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">New Work Order</h1>
        <p className="text-sm text-slate-500">
          {isCustomer ? 'Report an issue at one of your sites.' : 'Create a work order for a customer site.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer...</option>
                {customers.data?.content.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required disabled={!customerId}>
                <option value="">Select site...</option>
                {sites.data?.content.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
                ))}
              </Select>
            </div>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. AC unit not cooling" />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue..." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </Select>
              <Input label="Scheduled start" type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
              <Input label="Scheduled end" type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
            </div>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={create.isPending} disabled={!customerId || !siteId || !title}>
            Create work order
          </Button>
        </div>
      </form>
    </div>
  );
}
