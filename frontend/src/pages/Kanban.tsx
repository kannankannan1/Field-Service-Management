import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workOrderApi } from '../api';
import type { WorkOrderCard as CardType, WorkOrderStatus } from '../api/types';
import { Badge, Input, Select, Spinner } from '../components/ui';
import {
  formatTimeAgo,
  PRIORITY_LABELS,
  priorityBadgeClass,
  STATUS_LABELS,
  STATUS_ORDER,
  VALID_TRANSITIONS,
} from '../lib/labels';
import { errorMessage } from '../api/client';

export default function Kanban() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);

  const board = useQuery({
    queryKey: ['kanban', { search, priority }],
    queryFn: () =>
      workOrderApi.kanban({
        search: search || undefined,
        priority: priority || undefined,
      }),
    refetchInterval: 10000,
  });

  const move = useMutation({
    mutationFn: ({ id, toStatus }: { id: number; toStatus: WorkOrderStatus }) =>
      workOrderApi.changeStatus(id, { toStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  const cards = useMemo(() => {
    const map: Record<WorkOrderStatus, CardType[]> = {
      NEW: [], ASSIGNED: [], IN_PROGRESS: [], ON_HOLD: [], COMPLETED: [], CLOSED: [],
    };
    const data = board.data;
    if (data) {
      STATUS_ORDER.forEach((s) => {
        map[s] = data[s] ?? [];
      });
    }
    return map;
  }, [board.data]);

  const onDrop = (target: WorkOrderStatus) => {
    if (dragging === null) return;
    const card = STATUS_ORDER.flatMap((s) => cards[s]).find((c) => c.id === dragging);
    setDragging(null);
    if (!card || card.status === target) return;
    if (!VALID_TRANSITIONS[card.status].includes(target)) return;
    move.mutate({ id: card.id, toStatus: target });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Kanban Board</h1>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live (10s refresh) · drag cards between valid lifecycle states
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-44">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      {board.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-3 gap-4 xl:grid-cols-6">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(status)}
              className="flex max-h-[calc(100vh-220px)] flex-col rounded-lg border border-slate-200 bg-slate-50"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
                <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                  {cards[status].length}
                </Badge>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {cards[status].map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragging(card.id)}
                    onClick={() => navigate(`/work-orders/${card.id}`)}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-brand-600">{card.workOrderNumber}</span>
                      <Badge className={priorityBadgeClass(card.priority)}>{PRIORITY_LABELS[card.priority]}</Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800">{card.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{card.customerName} · {card.siteName}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-500">{card.assignedTechnicianName ?? 'Unassigned'}</span>
                      <span className={card.slaBreached ? 'font-semibold text-red-600' : 'text-slate-400'}>
                        {formatTimeAgo(card.slaDueAt)}
                      </span>
                    </div>
                    {VALID_TRANSITIONS[status].length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {VALID_TRANSITIONS[status].map((next) => (
                          <button
                            key={next}
                            onClick={(e) => {
                              e.stopPropagation();
                              move.mutate({ id: card.id, toStatus: next });
                            }}
                            className="rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                          >
                            → {STATUS_LABELS[next]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {cards[status].length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {move.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage(move.error)}
        </div>
      )}
    </div>
  );
}
