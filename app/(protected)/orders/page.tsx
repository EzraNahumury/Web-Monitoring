'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce, apiUpdateOrder } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { STAGES, RISK_STYLES, RISK_LABELS, STATUS_STYLES, STATUS_LABELS } from '@/lib/constants';
import { formatDate, getProgressPercent, getCurrentStage } from '@/lib/utils';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => { fetchOrders(false); }, []);

  async function fetchOrders(force = false) {
    try {
      const res = force ? await apiGetOrdersForce() : await apiGetOrders();
      if (res.success && res.data) { setOrders(res.data); setError(''); }
      else setError(res.error || 'Gagal memuat order');
    } catch {
      setError('Gagal terhubung ke server');
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !search || o.customer.toLowerCase().includes(search.toLowerCase()) ||
        o.noWorkOrder?.toLowerCase().includes(search.toLowerCase()) ||
        o.keterangan?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchRisk = riskFilter === 'ALL' || o.riskLevel === riskFilter;
      return matchSearch && matchStatus && matchRisk;
    });
  }, [orders, search, statusFilter, riskFilter]);

  if (loading) return <TableSkeleton />;
  if (error) return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-slate-500 mb-4">{error}</p>
      <button onClick={() => fetchOrders(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Coba Lagi</button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Cari customer, WO, keterangan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="OPEN">Baru</option>
            <option value="IN_PROGRESS">Proses</option>
            <option value="DONE">Selesai</option>
          </select>

          {/* Risk filter */}
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="NEAR">Near Deadline</option>
            <option value="OVERDUE">Overdue</option>
            <option value="NORMAL">Normal</option>
          </select>
        </div>

        {/* Action button */}
        {user?.role === 'cs' && (
          <Link
            href="/orders/new"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Input Order
          </Link>
        )}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: `${orders.filter(o => o.status === 'OPEN').length} Baru`, cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
          { label: `${orders.filter(o => o.status === 'IN_PROGRESS').length} Proses`, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
          { label: `${orders.filter(o => o.status === 'DONE').length} Selesai`, cls: 'bg-green-50 text-green-700 border border-green-200' },
          { label: `${orders.filter(o => o.riskLevel === 'OVERDUE').length} Overdue`, cls: 'bg-red-600 text-white border border-red-600' },
        ].map(b => (
          <span key={b.label} className={`px-3 py-1 rounded-full font-medium ${b.cls}`}>{b.label}</span>
        ))}
        {filtered.length !== orders.length && (
          <span className="px-3 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
            Menampilkan {filtered.length} dari {orders.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bahan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">DP Produksi</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">DL Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tgl Selesai</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(order => (
                <tr key={order.rowIndex} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelected(order)}>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{order.no}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{order.customer}</div>
                    {order.noWorkOrder && <div className="text-xs text-slate-400">{order.noWorkOrder}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{order.qty}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-800 font-medium">{order.paket1}</span>
                    <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{order.paket2}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order.bahan || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.dpProduksi)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.dlCust)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.tglSelesai)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-24">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${getProgressPercent(order.progress)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 shrink-0">{getProgressPercent(order.progress)}%</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{getCurrentStage(order.progress)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${RISK_STYLES[order.riskLevel || 'NORMAL']}`}>
                      {RISK_LABELS[order.riskLevel || 'NORMAL']}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(order); }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Tidak ada order yang sesuai filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} canEdit={user?.role === 'cs'} onSaved={fetchOrders} />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, canEdit, onSaved }: {
  order: Order; onClose: () => void; canEdit: boolean; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ keterangan: order.keterangan, bahan: order.bahan });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await apiUpdateOrder({ rowIndex: order.rowIndex, ...form });
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{order.customer}</h3>
            <p className="text-sm text-slate-500">{order.noWorkOrder || `#${order.no}`}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Qty" value={`${order.qty} pcs`} />
            <InfoRow label="Paket" value={`${order.paket1} ${order.paket2}`} />
            <InfoRow label="Bahan" value={order.bahan || '-'} />
            <InfoRow label="DP Produksi" value={formatDate(order.dpProduksi)} />
            <InfoRow label="DL Customer" value={formatDate(order.dlCust)} />
            <InfoRow label="Tgl Selesai" value={formatDate(order.tglSelesai)} highlight />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
            <span className="text-slate-500 text-xs block mb-1">Keterangan</span>
            <span className="text-slate-700">{order.keterangan || '-'}</span>
          </div>

          {/* Progress checklist */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progress Tahapan</p>
            <div className="grid grid-cols-3 gap-2">
              {STAGES.map((s) => {
                const checked = order.progress[s.key as keyof typeof order.progress];
                return (
                  <div key={s.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${checked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <svg className={`w-3.5 h-3.5 shrink-0 ${checked ? 'text-indigo-500' : 'text-slate-300'}`} fill={checked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_STYLES[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${RISK_STYLES[order.riskLevel || 'NORMAL']}`}>
              {RISK_LABELS[order.riskLevel || 'NORMAL']}
            </span>
            {order.daysLeft != null && (
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${order.daysLeft < 0 ? 'bg-red-600 text-white' : order.daysLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {order.daysLeft < 0 ? `${Math.abs(order.daysLeft)} hari lewat` : `${order.daysLeft} hari lagi`}
              </span>
            )}
          </div>
        </div>

        {canEdit && order.status === 'OPEN' && (
          <div className="px-6 pb-6">
            <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
      <span className="text-xs text-slate-400 block mb-0.5">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-indigo-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-slate-200 rounded-xl animate-pulse w-1/3" />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 border-b border-slate-50 animate-pulse bg-slate-50" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
