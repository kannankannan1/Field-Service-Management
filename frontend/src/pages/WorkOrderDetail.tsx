import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partApi, timeLogApi, userApi, workOrderApi } from '../api';
import { errorMessage } from '../api/client';
import type { WorkOrderStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import {
  formatDate,
  formatTimeAgo,
  PRIORITY_LABELS,
  priorityBadgeClass,
  STATUS_LABELS,
  statusBadgeClass,
  VALID_TRANSITIONS,
} from '../lib/labels';

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const woId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [transitionNote, setTransitionNote] = useState('');
  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wo = useQuery({
    queryKey: ['work-orders', woId],
    queryFn: () => workOrderApi.get(woId),
  });
  const history = useQuery({
    queryKey: ['work-orders', woId, 'history'],
    queryFn: () => workOrderApi.history(woId),
  });
  const timeLogs = useQuery({
    queryKey: ['work-orders', woId, 'time-logs'],
    queryFn: () => timeLogApi.forWorkOrder(woId),
    enabled: user?.role !== 'CUSTOMER',
  });
  const partsUsed = useQuery({
    queryKey: ['work-orders', woId, 'parts'],
    queryFn: () => partApi.forWorkOrder(woId),
    enabled: user?.role !== 'CUSTOMER',
  });
  const technicians = useQuery({
    queryKey: ['users', 'technicians'],
    queryFn: () => userApi.list({ role: 'TECHNICIAN', size: 100 }),
  });
  const parts = useQuery({
    queryKey: ['parts'],
    queryFn: () => partApi.list({ size: 100 }),
    enabled: consumeOpen,
  });

  const changeStatus = useMutation({
    mutationFn: (toStatus: WorkOrderStatus) => workOrderApi.changeStatus(woId, { toStatus, note: transitionNote || undefined }),
    onSuccess: () => {
      ['work-orders', 'kanban', 'dashboard', 'notifications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setTransitionNote('');
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const assign = useMutation({
    mutationFn: (technicianId: number) => workOrderApi.assign(woId, technicianId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['kanban'] });
      setAssignOpen(false);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const startTimer = useMutation({
    mutationFn: () => timeLogApi.start(woId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders', woId, 'time-logs'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const stopTimer = useMutation({
    mutationFn: (timeLogId: number) => timeLogApi.stop(timeLogId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders', woId, 'time-logs'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const consume = useMutation({
    mutationFn: ({ partId, quantity, note }: { partId: number; quantity: number; note?: string }) =>
      partApi.consume(woId, partId, quantity, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders', woId, 'parts'] });
      qc.invalidateQueries({ queryKey: ['parts'] });
      setConsumeOpen(false);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const [consumePartId, setConsumePartId] = useState('');
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeNote, setConsumeNote] = useState('');

  if (wo.isLoading) return <Spinner />;
  if (wo.isError || !wo.data) {
    return (
      <Card>
        <p className="text-sm text-red-600">Failed to load work order.</p>
        <Button variant="secondary" className="mt-3" onClick={() => navigate(-1)}>Back</Button>
      </Card>
    );
  }

  const data = wo.data;
  const runningLog = timeLogs.data?.find((l) => !l.endTime);
  const canManage = user?.role === 'MANAGER' || user?.role === 'DISPATCHER';
  const canWork = user?.role === 'TECHNICIAN';
  const nextStates = VALID_TRANSITIONS[data.status];

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back
      </button>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-brand-700">{data.workOrderNumber}</span>
              <Badge className={statusBadgeClass(data.status)}>{STATUS_LABELS[data.status]}</Badge>
              <Badge className={priorityBadgeClass(data.priority)}>{PRIORITY_LABELS[data.priority]}</Badge>
              {data.slaBreached && <Badge className="border-red-200 bg-red-100 text-red-700">SLA breached</Badge>}
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{data.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                Assign technician
              </Button>
            )}
            {nextStates.map((next) => (
              <Button
                key={next}
                onClick={() => {
                  setPendingStatus(next);
                  setTransitionNote('');
                }}
              >
                Move to {STATUS_LABELS[next]}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Details">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Customer</div>
                <div className="mt-1 font-medium text-slate-800">{data.customerName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Site</div>
                <div className="mt-1 font-medium text-slate-800">{data.siteName}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">Address</div>
                <div className="mt-1 text-slate-700">{data.siteAddress}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Scheduled start</div>
                <div className="mt-1 text-slate-700">{formatDate(data.scheduledStart)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Scheduled end</div>
                <div className="mt-1 text-slate-700">{formatDate(data.scheduledEnd)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">SLA due</div>
                <div className="mt-1 text-slate-700">{formatDate(data.slaDueAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Assigned to</div>
                <div className="mt-1 text-slate-700">{data.assignedTechnicianName ?? 'Unassigned'}</div>
              </div>
              {data.description && (
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Description</div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{data.description}</p>
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Created by</div>
                <div className="mt-1 text-slate-700">{data.createdByName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Created</div>
                <div className="mt-1 text-slate-700">{formatTimeAgo(data.createdAt)}</div>
              </div>
            </div>
          </Card>

          <Card title="Status History (immutable audit trail)">
            <ol className="space-y-0">
              {history.data?.map((h, i) => (
                <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < (history.data?.length ?? 0) - 1 && (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />
                  )}
                  <span className={`mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${h.fromStatus ? 'border-brand-500 bg-white' : 'border-emerald-500 bg-emerald-500'}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-800">
                      {h.fromStatus ? (
                        <span>
                          <span className="font-medium">{STATUS_LABELS[h.fromStatus]}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-semibold">{STATUS_LABELS[h.toStatus]}</span>
                        </span>
                      ) : (
                        <span className="font-semibold">Work order created</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {h.changedByName} · {formatDate(h.changedAt)}
                    </div>
                    {h.note && <p className="mt-0.5 text-xs text-slate-500 italic">"{h.note}"</p>}
                  </div>
                </li>
              ))}
              {!history.data && <p className="text-sm text-slate-400">Loading...</p>}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Time Logs"
            action={
              canWork && runningLog ? (
                <Button variant="danger" loading={stopTimer.isPending} onClick={() => stopTimer.mutate(runningLog.id)}>
                  Stop timer
                </Button>
              ) : canWork ? (
                <Button loading={startTimer.isPending} onClick={() => startTimer.mutate()}>
                  Start timer
                </Button>
              ) : undefined
            }
          >
            {runningLog && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Timer running since {formatDate(runningLog.startTime)}
              </div>
            )}
            {timeLogs.data && timeLogs.data.length === 0 ? (
              <p className="text-sm text-slate-400">No time logged yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {timeLogs.data?.map((l) => (
                  <li key={l.id} className="py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{l.technicianName}</span>
                      <span className="text-xs text-slate-500">{l.endTime ? `${l.hoursWorked ?? 0}h` : 'running'}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatDate(l.startTime)} {l.endTime ? `→ ${formatDate(l.endTime)}` : ''}
                    </div>
                    {l.notes && <p className="mt-0.5 text-xs text-slate-400">{l.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Parts Consumed"
            action={
              canManage || canWork ? (
                <Button variant="secondary" onClick={() => setConsumeOpen(true)}>
                  Consume part
                </Button>
              ) : undefined
            }
          >
            {partsUsed.data && partsUsed.data.length === 0 ? (
              <p className="text-sm text-slate-400">No parts consumed.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {partsUsed.data?.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-700">{m.partName}</div>
                      <div className="text-xs text-slate-400">{m.partSku}</div>
                    </div>
                    <span className="font-semibold text-slate-800">
                      -{Math.abs(m.quantityChange)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Assign ${data.workOrderNumber}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
          </>
        }
      >
        <div className="space-y-2">
          {(technicians.data?.content ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => assign.mutate(t.id)}
              disabled={assign.isPending}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
            >
              <span className="text-sm font-medium text-slate-800">{t.fullName}</span>
              <span className="text-xs text-slate-400">{t.username}</span>
            </button>
          ))}
          {technicians.data?.content.length === 0 && (
            <p className="text-sm text-slate-400">No technicians available.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        title={`Move to ${pendingStatus ? STATUS_LABELS[pendingStatus] : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingStatus(null)}>Cancel</Button>
            <Button
              loading={changeStatus.isPending}
              onClick={() => {
                if (pendingStatus) changeStatus.mutate(pendingStatus);
                setPendingStatus(null);
              }}
            >
              Confirm transition
            </Button>
          </>
        }
      >
        <Textarea
          label="Note (optional)"
          value={transitionNote}
          onChange={(e) => setTransitionNote(e.target.value)}
          rows={3}
          placeholder="Add a note to the audit trail..."
        />
      </Modal>

      <Modal
        open={consumeOpen}
        onClose={() => setConsumeOpen(false)}
        title="Consume part on this work order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConsumeOpen(false)}>Cancel</Button>
            <Button
              loading={consume.isPending}
              disabled={!consumePartId || Number(consumeQty) < 1}
              onClick={() =>
                consume.mutate({
                  partId: Number(consumePartId),
                  quantity: Number(consumeQty),
                  note: consumeNote || undefined,
                })
              }
            >
              Deduct stock
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Part" value={consumePartId} onChange={(e) => setConsumePartId(e.target.value)}>
            <option value="">Select part...</option>
            {parts.data?.content.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {p.quantityOnHand} on hand
              </option>
            ))}
          </Select>
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={consumeQty}
            onChange={(e) => setConsumeQty(e.target.value)}
          />
          <Input label="Note (optional)" value={consumeNote} onChange={(e) => setConsumeNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
