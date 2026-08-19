import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workOrderApi } from '../api';
import type { WorkOrderPriority, WorkOrderStatus } from '../api/types';
import { Badge, Button, Card, EmptyState, Input, Pagination, Select, Spinner } from '../components/ui';
import {
  formatDate,
  PRIORITY_LABELS,
  priorityBadgeClass,
  STATUS_LABELS,
  statusBadgeClass,
} from '../lib/labels';

export default function WorkOrders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['work-orders', { search, status, priority, page }],
    queryFn: () =>
      workOrderApi.list({
        search: search || undefined,
        status: (status || undefined) as WorkOrderStatus | undefined,
        priority: (priority || undefined) as WorkOrderPriority | undefined,
        page,
        size: 15,
      }),
  });

  if (query.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Work Orders</h1>
        <Button onClick={() => navigate('/work-orders/new')}>+ New Work Order</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input placeholder="Search number, title, customer, site..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="w-44">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(0); }}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      {query.isError ? (
        <Card><p className="text-sm text-red-600">Failed to load work orders.</p></Card>
      ) : !query.data || query.data.content.length === 0 ? (
        <EmptyState message="No work orders match your filters." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">SLA Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.content.map((wo) => (
                  <tr key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-brand-600">{wo.workOrderNumber}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-800">{wo.title}</td>
                    <td className="px-4 py-3 text-slate-600">{wo.customerName}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{wo.siteName}</td>
                    <td className="px-4 py-3">
                      <Badge className={priorityBadgeClass(wo.priority)}>{PRIORITY_LABELS[wo.priority]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={statusBadgeClass(wo.status)}>{STATUS_LABELS[wo.status]}</Badge>
                        {wo.slaBreached && (
                          <Badge className="border-red-200 bg-red-100 text-red-700">SLA breached</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.assignedTechnicianName ?? '—'}</td>
                    <td className={`px-4 py-3 text-xs ${wo.slaBreached ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                      {formatDate(wo.slaDueAt)}
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
    </div>
  );
}
