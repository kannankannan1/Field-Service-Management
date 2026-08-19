import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeLogApi, workOrderApi } from '../api';
import { errorMessage } from '../api/client';
import type { WorkOrderStatus } from '../api/types';
import { Badge, Button, Card, EmptyState, Select, Spinner } from '../components/ui';
import {
  formatDate,
  PRIORITY_LABELS,
  priorityBadgeClass,
  STATUS_LABELS,
  statusBadgeClass,
  VALID_TRANSITIONS,
} from '../lib/labels';

export default function TechnicianJobs() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const jobs = useQuery({
    queryKey: ['my-jobs', filter],
    queryFn: () =>
      workOrderApi.list({
        status: (filter || undefined) as WorkOrderStatus | undefined,
        page: 0,
        size: 50,
      }),
    refetchInterval: 15000,
  });

  const myLogs = useQuery({
    queryKey: ['my-time-logs'],
    queryFn: () => timeLogApi.mine(),
    refetchInterval: 15000,
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, toStatus }: { id: number; toStatus: WorkOrderStatus }) =>
      workOrderApi.changeStatus(id, { toStatus }),
    onSuccess: () => {
      ['my-jobs', 'work-orders', 'kanban', 'notifications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const startTimer = useMutation({
    mutationFn: (woId: number) => timeLogApi.start(woId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-time-logs'] }),
    onError: (e) => setError(errorMessage(e)),
  });

  const stopTimer = useMutation({
    mutationFn: (logId: number) => timeLogApi.stop(logId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-time-logs'] }),
    onError: (e) => setError(errorMessage(e)),
  });

  const running = myLogs.data?.find((l) => !l.endTime);
  const myIds = new Set((jobs.data?.content ?? []).map((w) => w.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">My Jobs</h1>
        <div className="flex items-center gap-3">
          {running ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Timer running on {running.workOrderNumber}
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => stopTimer.mutate(running.id)}>
                Stop
              </Button>
            </div>
          ) : null}
          <div className="w-40">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {jobs.isLoading ? (
        <Spinner />
      ) : !jobs.data || jobs.data.content.length === 0 ? (
        <EmptyState message="No work orders assigned to you." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.data.content.map((wo) => (
            <Card key={wo.id} className="flex flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-brand-600">{wo.workOrderNumber}</span>
                <Badge className={priorityBadgeClass(wo.priority)}>{PRIORITY_LABELS[wo.priority]}</Badge>
              </div>
              <button onClick={() => navigate(`/work-orders/${wo.id}`)} className="mt-1.5 text-left text-sm font-semibold text-slate-800 hover:text-brand-600">
                {wo.title}
              </button>
              <p className="mt-1 text-xs text-slate-500">{wo.customerName} · {wo.siteName}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge className={statusBadgeClass(wo.status)}>{STATUS_LABELS[wo.status]}</Badge>
                <span className="text-xs text-slate-400">{formatDate(wo.slaDueAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {VALID_TRANSITIONS[wo.status].length > 0 && (
                  <Button
                    className="flex-1 text-xs"
                    loading={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: wo.id, toStatus: VALID_TRANSITIONS[wo.status][0] })}
                  >
                    → {STATUS_LABELS[VALID_TRANSITIONS[wo.status][0]]}
                  </Button>
                )}
                {running ? (
                  running.workOrderId === wo.id && (
                    <Button variant="danger" className="flex-1 text-xs" onClick={() => stopTimer.mutate(running.id)}>
                      Stop timer
                    </Button>
                  )
                ) : myIds.has(wo.id) ? (
                  <Button variant="secondary" className="flex-1 text-xs" onClick={() => startTimer.mutate(wo.id)}>
                    Start timer
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
