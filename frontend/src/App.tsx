import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import NewWorkOrder from './pages/NewWorkOrder';
import Kanban from './pages/Kanban';
import Customers from './pages/Customers';
import Sites from './pages/Sites';
import Parts from './pages/Parts';
import Notifications from './pages/Notifications';
import TechnicianJobs from './pages/TechnicianJobs';
import CustomerPortal from './pages/CustomerPortal';
import type { Role } from './api/types';

function homeFor(role: Role): string {
  switch (role) {
    case 'TECHNICIAN':
      return '/my-jobs';
    case 'CUSTOMER':
      return '/portal';
    default:
      return '/dashboard';
  }
}

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        element={
          <RequireRole roles={['MANAGER', 'DISPATCHER', 'TECHNICIAN', 'CUSTOMER']}>
            <Layout />
          </RequireRole>
        }
      >
        <Route path="/dashboard" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><Dashboard /></RequireRole>} />
        <Route path="/work-orders" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><WorkOrders /></RequireRole>} />
        <Route path="/work-orders/new" element={<RequireRole roles={['MANAGER', 'DISPATCHER', 'CUSTOMER']}><NewWorkOrder /></RequireRole>} />
        <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="/kanban" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><Kanban /></RequireRole>} />
        <Route path="/customers" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><Customers /></RequireRole>} />
        <Route path="/sites" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><Sites /></RequireRole>} />
        <Route path="/parts" element={<RequireRole roles={['MANAGER', 'DISPATCHER']}><Parts /></RequireRole>} />
        <Route path="/my-jobs" element={<RequireRole roles={['TECHNICIAN']}><TechnicianJobs /></RequireRole>} />
        <Route path="/portal" element={<RequireRole roles={['CUSTOMER']}><CustomerPortal /></RequireRole>} />
        <Route path="/portal/new" element={<RequireRole roles={['CUSTOMER']}><NewWorkOrder /></RequireRole>} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
