'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce } from '@/lib/api';
import { apiUpdateProgress } from '@/lib/api';
import { Order, Progress } from '@/lib/types';
import { STAGES, RISK_STYLES, RISK_LABELS, STATUS_STYLES, STATUS_LABELS } from '@/lib/constants';
import { formatDate, getProgressPercent, getStageIndex } from '@/lib/utils';

export default function ProductionPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'NEAR'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tglKirim, setTglKirim] = useState('');
  const [showTglKirim, setShowTglKirim] = useState<number | null>(null);

  useEffect(() => { fetchOrders(false); }, []);

  async function fetchOrders(force = false) {
    try {
      // Use cache first → shows data instantly; force bypasses cache
      const res = force ? await apiGetOrdersForce() : await apiGetOrders();
      if (res.success && res.data) {
        setOrders(res.data);
        setError('');
      } else {
        setError(res.error || 'Gagal memuat data');
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setLoading(false);
    setRefreshing(false);
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchOrders(true);
  }

  const canEdit = user?.role === 'produksi' || user?.role === 'admin';

  const parseDateMs = (s: string) => {
    if (!s) return Infinity;
    const p = s.split('/');
    if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]).getTime();
    const d = new Date(s); return isNaN(d.getTime()) ? Infinity : d.getTime();
  };

  const sortedDates = useMemo(() => {
    const keys = new Set(orders.filter(o => o.status !== 'DONE').map(o => o.tglSelesai || o.dlCust || '').filter(Boolean));
    return Array.from(keys).sort((a, b) => parseDateMs(a) - parseDateMs(b));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter(o => o.status !== 'DONE' || filter === 'ALL')
      .filter(o => {
        if (filter === 'ACTIVE') return o.status === 'IN_PROGRESS' || o.status === 'OPEN';
        if (filter === 'OVERDUE') return o.riskLevel === 'OVERDUE';
        if (filter === 'NEAR') return o.riskLevel === 'NEAR' || o.riskLevel === 'HIGH';
        return true;
      })
      .filter(o => !search || o.customer.toLowerCase().includes(search.toLowerCase()) || o.noWorkOrder?.toLowerCase().includes(search.toLowerCase()))
      .filter(o => !dateFilter || (o.tglSelesai || o.dlCust || '') === dateFilter)
      .sort((a, b) => {
        const riskOrder = { OVERDUE: 0, HIGH: 1, NEAR: 2, NORMAL: 3, SAFE: 4 };
        const ra = riskOrder[a.riskLevel || 'NORMAL'] ?? 3;
        const rb = riskOrder[b.riskLevel || 'NORMAL'] ?? 3;
        return ra - rb;
      });
  }, [orders, search, filter, dateFilter]);

  async function handleCheck(order: Order, stageKey: string, checked: boolean) {
    if (!canEdit) return;

    const stageIdx = STAGES.findIndex(s => s.key === stageKey);
    const lastCheckedIdx = getStageIndex(order.progress);

    // Must be sequential
    if (checked && stageIdx > lastCheckedIdx + 1) {
      alert(`Harus menyelesaikan ${STAGES[lastCheckedIdx + 1]?.label} terlebih dahulu!`);
      return;
    }

    // If PENGIRIMAN, ask for tgl kirim
    if (stageKey === 'PENGIRIMAN' && checked) {
      setShowTglKirim(order.rowIndex);
      return;
    }

    const key = `${order.rowIndex}-${stageKey}`;
    setUpdating(key);
    try {
      const res = await apiUpdateProgress({ rowIndex: order.rowIndex, stage: stageKey, checked });
      if (res.success) {
        setOrders(prev => prev.map(o => {
          if (o.rowIndex !== order.rowIndex) return o;
          const newProgress = { ...o.progress, [stageKey]: checked };
          const hasAny = Object.values(newProgress).some(v => v);
          const allDone = newProgress.PENGIRIMAN;
          return { ...o, progress: newProgress, status: allDone ? 'DONE' : hasAny ? 'IN_PROGRESS' : 'OPEN' };
        }));
      }
    } catch { }
    setUpdating(null);
  }

  async function confirmPengiriman(order: Order) {
    const key = `${order.rowIndex}-PENGIRIMAN`;
    setUpdating(key);
    try {
      const res = await apiUpdateProgress({ rowIndex: order.rowIndex, stage: 'PENGIRIMAN', checked: true, tglKirim: tglKirim || undefined });
      if (res.success) {
        setOrders(prev => prev.map(o => {
          if (o.rowIndex !== order.rowIndex) return o;
          return { ...o, progress: { ...o.progress, PENGIRIMAN: true }, status: 'DONE', tglKirim };
        }));
      }
    } catch { }
    setUpdating(null);
    setShowTglKirim(null);
    setTglKirim('');
  }

  if (loading) return <BoardSkeleton />;
  if (error) return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-slate-500 mb-4">{error}</p>
      <button onClick={() => fetchOrders(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Coba Lagi</button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Cari customer atau WO..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {(['ALL', 'ACTIVE', 'OVERDUE', 'NEAR'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {f === 'ALL' ? 'Semua' : f === 'ACTIVE' ? 'Aktif' : f === 'OVERDUE' ? '🔴 Overdue' : '🟡 Near DL'}
          </button>
        ))}

        <button onClick={handleRefresh} className={`bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm transition-colors ${refreshing ? 'opacity-60' : ''}`} title="Refresh" disabled={refreshing}>
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      {/* Date tabs */}
      {sortedDates.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setDateFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
              ${!dateFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
          >
            Semua tgl
          </button>
          {sortedDates.map(dk => {
            const count = orders.filter(o => o.status !== 'DONE' && (o.tglSelesai || o.dlCust || '') === dk).length;
            const hasOverdue = orders.some(o => (o.tglSelesai || o.dlCust || '') === dk && (o.riskLevel === 'OVERDUE' || o.riskLevel === 'HIGH'));
            return (
              <button
                key={dk}
                onClick={() => setDateFilter(dk)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
                  ${dateFilter === dk
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : hasOverdue
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
              >
                {formatDate(dk)}
                <span className={`ml-1 tabular-nums ${dateFilter === dk ? 'opacity-80' : hasOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Count badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">{filtered.length} order ditampilkan</span>
        {filtered.filter(o => o.riskLevel === 'OVERDUE').length > 0 && (
          <span className="px-3 py-1 rounded-full bg-red-600 text-white font-semibold">{filtered.filter(o => o.riskLevel === 'OVERDUE').length} Overdue</span>
        )}
        {filtered.filter(o => o.riskLevel === 'HIGH').length > 0 && (
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">{filtered.filter(o => o.riskLevel === 'HIGH').length} High Risk</span>
        )}
      </div>

      {/* Order cards */}
      <div className="space-y-3">
        {filtered.map(order => (
          <OrderCard
            key={order.rowIndex}
            order={order}
            expanded={expanded === order.rowIndex}
            onToggle={() => setExpanded(prev => prev === order.rowIndex ? null : order.rowIndex)}
            onCheck={(stage, checked) => handleCheck(order, stage, checked)}
            updating={updating}
            canEdit={canEdit}
            onPengirimanClick={() => setShowTglKirim(order.rowIndex)}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            <p className="text-slate-500 text-sm">Tidak ada order yang sesuai filter</p>
          </div>
        )}
      </div>

      {/* Tgl Kirim modal */}
      {showTglKirim !== null && (() => {
        const order = orders.find(o => o.rowIndex === showTglKirim);
        if (!order) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-1">Konfirmasi Pengiriman</h3>
              <p className="text-sm text-slate-500 mb-4">Order: <strong>{order.customer}</strong></p>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tanggal Kirim (opsional)</label>
              <input
                type="date"
                value={tglKirim}
                onChange={e => setTglKirim(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowTglKirim(null); setTglKirim(''); }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={() => confirmPengiriman(order)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold"
                >
                  Konfirmasi Kirim
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function OrderCard({ order, expanded, onToggle, onCheck, updating, canEdit, onPengirimanClick }: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onCheck: (stage: string, checked: boolean) => void;
  updating: string | null;
  canEdit: boolean;
  onPengirimanClick: () => void;
}) {
  const pct = getProgressPercent(order.progress);
  const lastIdx = getStageIndex(order.progress);
  const riskStyle = RISK_STYLES[order.riskLevel || 'NORMAL'];
  const isHighPriority = order.riskLevel === 'HIGH' || order.riskLevel === 'OVERDUE';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isHighPriority ? 'border-red-200' : 'border-slate-200'}`}>
      {/* Card header - always visible */}
      <div
        className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isHighPriority ? 'bg-red-50/50' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          {/* Progress circle */}
          <div className="shrink-0 relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#f1f5f9" strokeWidth="4"/>
              <circle cx="24" cy="24" r="20" fill="none" stroke={pct === 100 ? '#22c55e' : '#4f46e5'} strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{pct}%</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <h3 className="font-bold text-slate-800 text-base">{order.customer}</h3>
                <p className="text-xs text-slate-400">{order.noWorkOrder || `#${order.no}`} · {order.qty} pcs · {order.paket1} {order.paket2}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${riskStyle}`}>
                  {RISK_LABELS[order.riskLevel || 'NORMAL']}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLES[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            </div>

            {/* Stage pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              {STAGES.map((s, i) => {
                const done = order.progress[s.key as keyof Progress];
                const current = !done && i === lastIdx + 1;
                return (
                  <span
                    key={s.key}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${done ? 'bg-indigo-600 text-white' : current ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {s.label}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              {order.keterangan && <span>📝 {order.keterangan}</span>}
              <span>DL: {formatDate(order.tglSelesai || order.dlCust)}</span>
              {order.daysLeft != null && (
                <span className={`font-semibold ${order.daysLeft < 0 ? 'text-red-600' : order.daysLeft <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {order.daysLeft < 0 ? `⚠ ${Math.abs(order.daysLeft)}h lewat` : `${order.daysLeft} hari lagi`}
                </span>
              )}
            </div>
          </div>

          <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Expanded checklist */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Checklist Tahapan Produksi
            {!canEdit && <span className="ml-2 text-slate-400 normal-case font-normal">(read-only)</span>}
            {canEdit && order.status === 'DONE' && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full normal-case font-semibold">
                🔒 Selesai · Read-only
              </span>
            )}
          </p>
          <div className="space-y-2">
            {STAGES.map((s, i) => {
              const checked = order.progress[s.key as keyof Progress];
              const key = `${order.rowIndex}-${s.key}`;
              const isUpdating = updating === key;
              const prevDone = i === 0 || order.progress[STAGES[i - 1].key as keyof Progress];
              const isDone = order.status === 'DONE';
              const canCheck = canEdit && !isUpdating && !isDone && (checked || prevDone);
              const isPengiriman = s.key === 'PENGIRIMAN';

              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${checked ? 'bg-indigo-50 border-indigo-200' : prevDone && canEdit ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                >
                  <div className="relative">
                    {isUpdating ? (
                      <svg className="animate-spin w-[18px] h-[18px] text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <input
                        type="checkbox"
                        className="stage-check"
                        checked={checked}
                        disabled={!canCheck}
                        onChange={e => {
                          if (isPengiriman && e.target.checked) { onPengirimanClick(); return; }
                          onCheck(s.key, e.target.checked);
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${checked ? 'text-indigo-700' : 'text-slate-600'}`}>
                      {i + 1}. {s.label}
                    </span>
                    {i === lastIdx && !checked && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">Selanjutnya</span>
                    )}
                    {i === lastIdx && checked && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Tahap ini</span>
                    )}
                  </div>
                  {checked && (
                    <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {order.status === 'DONE' && order.tglKirim && (
            <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
              ✅ Dikirim pada: <strong>{formatDate(order.tglKirim)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 h-24 animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}
