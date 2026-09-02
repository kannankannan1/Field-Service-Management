import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Modal, Pagination, Select, Spinner } from '../components/ui';
import { formatDate, typeBadgeClass } from '../lib/labels';

export default function Parts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ id: number; name: string; sku: string; quantityOnHand: number } | null>(null);
  const [adjustType, setAdjustType] = useState<'PURCHASE' | 'ADJUSTMENT'>('PURCHASE');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustNote, setAdjustNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['parts', { search, page }],
    queryFn: () => partApi.list({ search: search || undefined, page, size: 12 }),
  });
  const movements = useQuery({
    queryKey: ['parts', selected?.id, 'movements'],
    queryFn: () => partApi.movements(selected!.id),
    enabled: !!selected,
  });

  const adjust = useMutation({
    mutationFn: () => partApi.adjust(selected!.id, adjustType, Number(adjustQty), adjustNote || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected(null);
      setAdjustQty('1');
      setAdjustNote('');
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Parts Inventory</h1>
      </div>

      <div className="w-64">
        <Input placeholder="Search parts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : query.isError || !query.data || query.data.content.length === 0 ? (
        <EmptyState message="No parts found." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">On hand</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.content.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-slate-600">{p.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">${p.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{p.quantityOnHand}</td>
                    <td className="px-4 py-3">
                      {p.lowStock ? (
                        <Badge className="border-red-200 bg-red-100 text-red-700">Low stock</Badge>
                      ) : (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isManager && (
                        <Button variant="ghost" onClick={() => { setSelected(p); setError(null); }}>
                          Adjust
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />
          </div>
        </Card>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Adjust stock — ${selected.name}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              loading={adjust.isPending}
              disabled={Number(adjustQty) < 1}
              onClick={() => adjust.mutate()}
            >
              Apply adjustment
            </Button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Current on hand: <span className="font-semibold text-slate-900">{selected?.quantityOnHand}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" value={adjustType} onChange={(e) => setAdjustType(e.target.value as 'PURCHASE' | 'ADJUSTMENT')}>
              <option value="PURCHASE">Purchase (add stock)</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </Select>
            <Input label="Quantity" type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          </div>
          <Input label="Note (optional)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Stock movements"
        wide
      >
        {movements.isLoading ? (
          <Spinner size="sm" />
        ) : !movements.data || movements.data.length === 0 ? (
          <p className="text-sm text-slate-400">No movements recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movements.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <Badge className={typeBadgeClass(m.type)}>{m.type}</Badge>
                  {m.workOrderNumber && (
                    <span className="ml-2 text-xs text-slate-500">on {m.workOrderNumber}</span>
                  )}
                  {m.note && <p className="mt-0.5 text-xs text-slate-400">{m.note}</p>}
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${m.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.quantityChange >= 0 ? '+' : ''}{m.quantityChange}
                  </span>
                  <div className="text-xs text-slate-400">{formatDate(m.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
