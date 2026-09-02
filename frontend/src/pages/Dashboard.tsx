import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api';
import { Card, Spinner, StatCard } from '../components/ui';
import { Badge } from '../components/ui';
import { formatTimeAgo, PRIORITY_LABELS, STATUS_LABELS, statusBadgeClass } from '../lib/labels';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const metrics = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => dashboardApi.metrics(),
    refetchInterval: 5000,
  });

  if (metrics.isLoading) return <Spinner />;
  if (metrics.isError || !metrics.data) {
    return (
      <Card>
        <p className="text-sm text-red-600">Failed to load dashboard metrics.</p>
      </Card>
    );
  }

  const m = metrics.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Operations Dashboard</h1>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live (5s refresh)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open Work Orders" value={m.openWorkOrders} hint={`${m.totalWorkOrders} total`} />
        <StatCard
          label="Overdue / SLA Breached"
          value={m.overdueWorkOrders}
          hint={`${m.slaBreached} breached`}
          tone={m.overdueWorkOrders > 0 ? 'bad' : 'good'}
        />
        <StatCard
          label="SLA Compliance"
          value={`${m.slaComplianceRate}%`}
          tone={m.slaComplianceRate >= 90 ? 'good' : m.slaComplianceRate >= 75 ? 'warn' : 'bad'}
          hint="30-day average"
        />
        <StatCard
          label="Completed (30d)"
          value={m.completedLast30Days}
          hint={`avg ${m.averageCompletionHours}h to complete`}
        />
        <StatCard
          label="Technicians"
          value={m.totalTechnicians}
          hint={`${m.busyTechnicians} busy · ${m.idleTechnicians} idle`}
        />
        <StatCard
          label="Low Stock Parts"
          value={m.lowStockParts}
          hint={`${m.lowStockAlerts} alerts sent`}
          tone={m.lowStockParts > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Unread Dispatch Alerts"
          value={m.unreadDispatcherNotifications}
          tone={m.unreadDispatcherNotifications > 0 ? 'warn' : 'default'}
        />
        <StatCard label="By Status" value={<span className="text-base font-semibold">{Object.entries(m.byStatus).map(([k, v]) => `${STATUS_LABELS[k as keyof typeof STATUS_LABELS]}: ${v}`).join(' · ')}</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Open by Priority">
          <div className="space-y-4">
            {m.priorityOrder.map((p) => {
              const count = p === 'URGENT' ? m.openUrgent : p === 'HIGH' ? m.openHigh : p === 'MEDIUM' ? m.openMedium : m.openLow;
              const max = Math.max(m.openUrgent, m.openHigh, m.openMedium, m.openLow, 1);
              const color = p === 'URGENT' ? 'bg-red-500' : p === 'HIGH' ? 'bg-orange-500' : p === 'MEDIUM' ? 'bg-yellow-400' : 'bg-sky-500';
              return <Bar key={p} label={PRIORITY_LABELS[p]} value={count} max={max} color={color} />;
            })}
          </div>
        </Card>

        <Card title="Open by Status">
          <div className="space-y-4">
            {m.statusOrder
              .filter((s) => s !== 'COMPLETED' && s !== 'CLOSED')
              .map((s) => (
                <Bar
                  key={s}
                  label={STATUS_LABELS[s]}
                  value={m.byStatus[s] ?? 0}
                  max={Math.max(...m.statusOrder.map((x) => m.byStatus[x] ?? 0), 1)}
                  color="bg-brand-500"
                />
              ))}
          </div>
        </Card>

        <Card title="Technician Workload">
          <div className="space-y-3">
            {m.technicians.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{t.fullName}</span>
                <Badge className={t.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}>
                  {t.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
            {m.technicians.length === 0 && (
              <p className="text-sm text-slate-400">No technicians found</p>
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Recent Activity"
        action={
          <Link to="/work-orders" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all →
          </Link>
        }
      >
        {m.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {m.recentActivity.map((a) => (
              <li key={`${a.workOrderId}-${a.changedAt}`} className="flex items-center gap-3 py-2.5">
                <Badge className={a.toStatus ? statusBadgeClass(a.toStatus) : 'border-slate-200 bg-slate-100 text-slate-600'}>
                  {a.toStatus ? STATUS_LABELS[a.toStatus] : 'Updated'}
                </Badge>
                <Link to={`/work-orders/${a.workOrderId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-brand-600 hover:underline">
                  {a.workOrderNumber} · {a.title}
                </Link>
                <span className="text-xs text-slate-400">{a.actorName}</span>
                <span className="text-xs text-slate-400">{formatTimeAgo(a.changedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
