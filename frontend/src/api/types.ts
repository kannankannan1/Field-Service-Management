export type Role = 'MANAGER' | 'DISPATCHER' | 'TECHNICIAN' | 'CUSTOMER';

export interface RegisterRequest {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'CUSTOMER' | 'TECHNICIAN';
}

export type WorkOrderStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CLOSED';

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type StockMovementType = 'PURCHASE' | 'ADJUSTMENT' | 'CONSUMED';

export type NotificationType =
  | 'WORK_ORDER_ASSIGNED'
  | 'WORK_ORDER_STATUS_CHANGED'
  | 'WORK_ORDER_COMPLETED'
  | 'LOW_STOCK'
  | 'SLA_BREACH'
  | 'TIME_LOG_APPROVAL'
  | 'INFO';

export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresInSeconds?: number;
  user: User;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface Customer {
  id: number;
  name: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  userId?: number;
  portalUsername?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerRequest {
  name: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  createPortalUser?: boolean;
  portalUsername?: string;
  portalPassword?: string;
}

export interface Site {
  id: number;
  customerId: number;
  customerName: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  fullAddress: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SiteRequest {
  customerId: number;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export interface WorkOrder {
  id: number;
  workOrderNumber: string;
  customerId: number;
  customerName: string;
  siteId: number;
  siteName: string;
  siteAddress?: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechnicianId?: number;
  assignedTechnicianName?: string;
  createdById?: number;
  createdByName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  slaDueAt?: string;
  slaBreached: boolean;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
}

export interface WorkOrderCard {
  id: number;
  workOrderNumber: string;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  customerId: number;
  customerName: string;
  siteName: string;
  assignedTechnicianId?: number;
  assignedTechnicianName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  slaDueAt?: string;
  slaBreached: boolean;
}

export interface WorkOrderRequest {
  customerId: number;
  siteId: number;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface WorkOrderHistory {
  id: number;
  workOrderId: number;
  fromStatus?: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  changedById?: number;
  changedByName: string;
  changedAt: string;
  note?: string;
}

export interface Part {
  id: number;
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  quantityOnHand: number;
  reorderLevel: number;
  lowStock: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: number;
  partId: number;
  partSku: string;
  partName: string;
  workOrderId?: number;
  workOrderNumber?: string;
  type: StockMovementType;
  quantityChange: number;
  note?: string;
  createdAt: string;
}

export interface TimeLog {
  id: number;
  workOrderId: number;
  workOrderNumber: string;
  technicianId: number;
  technicianName: string;
  startTime: string;
  endTime?: string;
  hoursWorked?: number;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface RecentActivity {
  workOrderId: number;
  workOrderNumber: string;
  title: string;
  toStatus?: WorkOrderStatus;
  actorName: string;
  changedAt: string;
  note?: string;
}

export interface DashboardMetrics {
  totalWorkOrders: number;
  byStatus: Record<WorkOrderStatus, number>;
  openWorkOrders: number;
  overdueWorkOrders: number;
  slaBreached: number;
  slaComplianceRate: number;
  openUrgent: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  totalTechnicians: number;
  busyTechnicians: number;
  idleTechnicians: number;
  lowStockParts: number;
  lowStockAlerts: number;
  unreadDispatcherNotifications: number;
  averageCompletionHours: number;
  completedLast30Days: number;
  recentActivity: RecentActivity[];
  priorityOrder: WorkOrderPriority[];
  statusOrder: WorkOrderStatus[];
  technicians: User[];
}

export interface StatusChangeRequest {
  toStatus: WorkOrderStatus;
  note?: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
}
