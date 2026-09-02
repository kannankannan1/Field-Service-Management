import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { notificationApi } from '../api';
import { connectWebSocket, disconnectWebSocket, onNotification } from '../ws';
import { Badge } from './ui';
import { formatTimeAgo } from '../lib/labels';
import type { Role } from '../api/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const iconProps = {
  className: 'h-5 w-5',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
} as const;

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    to: '/work-orders',
    label: 'Work Orders',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    to: '/kanban',
    label: 'Kanban',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    to: '/customers',
    label: 'Customers',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 2.13a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        />
      </svg>
    ),
  },
  {
    to: '/sites',
    label: 'Sites',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    to: '/parts',
    label: 'Parts',
    roles: ['MANAGER', 'DISPATCHER'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    to: '/my-jobs',
    label: 'My Jobs',
    roles: ['TECHNICIAN'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    to: '/portal',
    label: 'My Portal',
    roles: ['CUSTOMER'],
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l9-9 9 9M5 10v10h14V10"
        />
      </svg>
    ),
  },
];

function NotificationBell() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { setOpen(false); }, [navigate]);

  const count = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: 15000,
    enabled: !!user,
  });

  const recent = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationApi.mine({ page: 0, size: 6 }),
    enabled: !!user,
  });

  useEffect(() => {
    const off = onNotification(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return off;
  }, [qc]);

  const unread = count.data ?? 0;
  const items = recent.data?.content ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        title="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341c-1.954.638-3.392 2.226-3.996 4.254A1.994 1.994 0 005.405 11l-1.405 1.405V17h5m0 0a2 2 0 11-4 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && items.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                className="block w-full border-b border-slate-100 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">
                    {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-500" />}
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatTimeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-1">
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full rounded px-3 py-1.5 text-center text-xs font-medium text-brand-600 hover:bg-brand-50"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/auth/me').then(() => true),
    retry: false,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  if (!user) return null;
  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role));
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-sm font-bold text-white">
            K
          </div>
          <div>
            <div className="text-sm font-bold text-white">Keystone</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Field Service</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user.fullName}</div>
              <Badge className="border-slate-600 bg-slate-800 text-slate-300">{user.role}</Badge>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 pl-60">
        {health.isError && (
          <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
            Cannot connect to the backend. Start it with: <code className="rounded bg-red-700 px-1.5 py-0.5">cd api &amp;&amp; npm run dev</code>
          </div>
        )}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 shadow-sm">
          <NotificationBell />
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
