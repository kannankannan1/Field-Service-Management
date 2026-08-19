import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui';
import { formatTimeAgo, typeBadgeClass } from '../lib/labels';

export default function Notifications() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.mine({ page: 0, size: 50 }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Notifications</h1>
        <Button variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          Mark all as read
        </Button>
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : !query.data || query.data.content.length === 0 ? (
        <EmptyState message="No notifications." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {query.data.content.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${n.read ? '' : 'bg-brand-50/50'}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    <span className="text-sm font-semibold text-slate-800">{n.title}</span>
                    <Badge className={typeBadgeClass(n.type)}>{n.type.split('_').join(' ')}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                  <span className="mt-1 block text-xs text-slate-400">{formatTimeAgo(n.createdAt)}</span>
                </div>
                {!n.read && (
                  <Button variant="ghost" onClick={() => markRead.mutate(n.id)}>
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
