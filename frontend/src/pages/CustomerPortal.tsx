import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi, siteApi, workOrderApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui';
import {
  formatDate,
  PRIORITY_LABELS,
  priorityBadgeClass,
  STATUS_LABELS,
  statusBadgeClass,
} from '../lib/labels';

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const customers = useQuery({
    queryKey: ['portal', 'customer'],
    queryFn: () => customerApi.list({ size: 1 }),
  });
  const sites = useQuery({
    queryKey: ['portal', 'sites'],
    queryFn: () => siteApi.list({}),
  });
  const wos = useQuery({
    queryKey: ['portal', 'work-orders'],
    queryFn: () => workOrderApi.list({ page: 0, size: 50 }),
    refetchInterval: 15000,
  });

  const customer = customers.data?.content[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Welcome, {user?.firstName}</h1>
          <p className="text-sm text-slate-500">
            {customer ? `${customer.name} portal` : 'Customer portal'}
          </p>
        </div>
        <Button onClick={() => navigate('/portal/new')}>+ Report an Issue</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Account">
          {customer ? (
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-slate-800">{customer.name}</p>
              <p className="text-slate-600">{customer.contactName}</p>
              <p className="text-slate-500">{customer.email}</p>
              {customer.phone && <p className="text-slate-500">{customer.phone}</p>}
              {customer.address && <p className="text-slate-500">{customer.address}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Account details unavailable.</p>
          )}
        </Card>
        <Card title="Your Sites">
          {sites.isLoading ? (
            <Spinner size="sm" />
          ) : !sites.data || sites.data.length === 0 ? (
            <p className="text-sm text-slate-400">No sites on file.</p>
          ) : (
            <ul className="space-y-2">
              {sites.data.map((s) => (
                <li key={s.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-700">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.city}, {s.state}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Status Summary">
          {wos.data ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                (wos.data.content ?? []).reduce<Record<string, number>>((acc, w) => {
                  acc[w.status] = (acc[w.status] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([status, count]) => (
                <Badge key={status} className={statusBadgeClass(status as keyof typeof STATUS_LABELS)}>
                  {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}: {count}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading...</p>
          )}
        </Card>
      </div>

      <Card title="My Work Orders" className="p-0">
        {wos.isLoading ? (
          <Spinner />
        ) : !wos.data || wos.data.content.length === 0 ? (
          <div className="p-4">
            <EmptyState message="No work orders yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">SLA Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wos.data.content.map((wo) => (
                  <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-brand-600">{wo.workOrderNumber}</td>
                    <td className="px-4 py-3 text-slate-800">{wo.title}</td>
                    <td className="px-4 py-3 text-slate-600">{wo.siteName}</td>
                    <td className="px-4 py-3">
                      <Badge className={priorityBadgeClass(wo.priority)}>{PRIORITY_LABELS[wo.priority]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusBadgeClass(wo.status)}>{STATUS_LABELS[wo.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.assignedTechnicianName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(wo.slaDueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
