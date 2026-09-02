import { api } from './client';
import type {
  Customer,
  CustomerRequest,
  DashboardMetrics,
  LoginResponse,
  Notification,
  PageResponse,
  Part,
  RegisterRequest,
  Site,
  SiteRequest,
  StockMovement,
  TimeLog,
  User,
  WorkOrder,
  WorkOrderCard,
  WorkOrderHistory,
  WorkOrderRequest,
  WorkOrderStatus,
  StatusChangeRequest,
} from './types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  register: (req: RegisterRequest) =>
    api.post<LoginResponse>('/auth/register', req).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  logout: () => api.post<void>('/auth/logout').then((r) => r.data),
};

export const userApi = {
  list: (params: { search?: string; page?: number; size?: number; role?: string }) =>
    api.get<PageResponse<User>>('/users', { params }).then((r) => r.data),
};

export const customerApi = {
  list: (params: { search?: string; page?: number; size?: number }) =>
    api.get<PageResponse<Customer>>('/customers', { params }).then((r) => r.data),
  create: (req: CustomerRequest) => api.post<Customer>('/customers', req).then((r) => r.data),
  update: (id: number, req: CustomerRequest) =>
    api.put<Customer>(`/customers/${id}`, req).then((r) => r.data),
  remove: (id: number) => api.delete<void>(`/customers/${id}`).then((r) => r.data),
};

export const siteApi = {
  list: (params: { customerId?: number; search?: string; page?: number; size?: number }) =>
    api.get<PageResponse<Site>>('/sites', { params }).then((r) => r.data),
  create: (req: SiteRequest) => api.post<Site>('/sites', req).then((r) => r.data),
  update: (id: number, req: SiteRequest) =>
    api.put<Site>(`/sites/${id}`, req).then((r) => r.data),
  remove: (id: number) => api.delete<void>(`/sites/${id}`).then((r) => r.data),
};

export const workOrderApi = {
  list: (params: {
    search?: string;
    status?: WorkOrderStatus;
    priority?: string;
    customerId?: number;
    siteId?: number;
    technicianId?: number;
    slaBreached?: boolean;
    page?: number;
    size?: number;
    sort?: string;
  }) => api.get<PageResponse<WorkOrder>>('/work-orders', { params }).then((r) => r.data),
  kanban: (params: { search?: string; priority?: string; technicianId?: number; customerId?: number; siteId?: number; slaBreached?: boolean }) =>
    api.get<Record<WorkOrderStatus, WorkOrderCard[]>>('/work-orders/kanban', { params }).then((r) => r.data),
  get: (id: number) => api.get<WorkOrder>(`/work-orders/${id}`).then((r) => r.data),
  create: (req: WorkOrderRequest) => api.post<WorkOrder>('/work-orders', req).then((r) => r.data),
  assign: (id: number, technicianId: number) =>
    api.post<WorkOrder>(`/work-orders/${id}/assign`, { technicianId }).then((r) => r.data),
  changeStatus: (id: number, req: StatusChangeRequest) =>
    api.patch<WorkOrder>(`/work-orders/${id}/status`, req).then((r) => r.data),
  history: (id: number) =>
    api.get<WorkOrderHistory[]>(`/work-orders/${id}/history`).then((r) => r.data),
};

export const timeLogApi = {
  start: (workOrderId: number) =>
    api.post<TimeLog>(`/work-orders/${workOrderId}/time-logs/start`).then((r) => r.data),
  stop: (timeLogId: number) =>
    api.post<TimeLog>(`/time-logs/${timeLogId}/stop`).then((r) => r.data),
  mine: () => api.get<TimeLog[]>('/time-logs/my').then((r) => r.data),
  forWorkOrder: (workOrderId: number) =>
    api.get<TimeLog[]>(`/work-orders/${workOrderId}/time-logs`).then((r) => r.data),
};

export const partApi = {
  list: (params: { search?: string; page?: number; size?: number }) =>
    api.get<PageResponse<Part>>('/parts', { params }).then((r) => r.data),
  low: () => api.get<Part[]>('/parts/low').then((r) => r.data),
  movements: (partId: number) =>
    api.get<StockMovement[]>(`/parts/${partId}/movements`).then((r) => r.data),
  adjust: (partId: number, type: 'PURCHASE' | 'ADJUSTMENT', quantity: number, note?: string) =>
    api.post<StockMovement>(`/parts/${partId}/stock`, { type, quantity, note }).then((r) => r.data),
  consume: (workOrderId: number, partId: number, quantity: number, note?: string) =>
    api.post<StockMovement>(`/parts/work-orders/${workOrderId}/consume`, { partId, quantity, note }).then((r) => r.data),
  forWorkOrder: (workOrderId: number) =>
    api.get<StockMovement[]>(`/parts/work-orders/${workOrderId}`).then((r) => r.data),
};

export const notificationApi = {
  mine: (params: { page?: number; size?: number }) =>
    api.get<PageResponse<Notification>>('/notifications', { params }).then((r) => r.data),
  unreadCount: () => api.get<number>('/notifications/unread-count').then((r) => r.data),
  markRead: (id: number) => api.post<Notification>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post<void>('/notifications/read-all').then((r) => r.data),
};

export const dashboardApi = {
  metrics: () => api.get<DashboardMetrics>('/dashboard/metrics').then((r) => r.data),
};
