import type { WorkOrderPriority, WorkOrderStatus, NotificationType, StockMovementType } from '../api/types';

export const STATUS_ORDER: WorkOrderStatus[] = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CLOSED',
];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};

export const PRIORITY_ORDER: WorkOrderPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  NEW: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED'],
  ON_HOLD: ['IN_PROGRESS'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
};

export const statusBadgeClass = (status: WorkOrderStatus): string => {
  switch (status) {
    case 'NEW':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'ASSIGNED':
      return 'bg-brand-50 text-brand-700 border-brand-200';
    case 'IN_PROGRESS':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ON_HOLD':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};

export const priorityBadgeClass = (priority: WorkOrderPriority): string => {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'LOW':
      return 'bg-sky-50 text-sky-700 border-sky-200';
  }
};

export const typeBadgeClass = (type: NotificationType | StockMovementType): string => {
  switch (type) {
    case 'SLA_BREACH':
    case 'LOW_STOCK':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'WORK_ORDER_ASSIGNED':
    case 'WORK_ORDER_STATUS_CHANGED':
    case 'WORK_ORDER_COMPLETED':
      return 'bg-brand-50 text-brand-700 border-brand-200';
    case 'CONSUMED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PURCHASE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgo(value?: string): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
