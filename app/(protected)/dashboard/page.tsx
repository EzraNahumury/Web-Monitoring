'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiGetDashboard, apiGetOrders, apiGetDashboardForce, apiGetOrdersForce } from '@/lib/api';
import { DashboardStats, Order } from '@/lib/types';
import { STAGES, RISK_STYLES, RISK_LABELS, STATUS_STYLES, STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 8;

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace(user.role === 'cs' ? '/orders' : '/production');
      return;
    }
    fetchData();
  }, [user]);

  async function fetchData(force = false) {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        force ? apiGetDashboardForce() : apiGetDashboard(),
        force ? apiGetOrdersForce() : apiGetOrders(),
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
      if (!statsRes.success) setError(statsRes.error || 'Gagal memuat data');
      else setError('');
    } catch {
      setError('Gagal terhubung. Cek konfigurasi APPS_SCRIPT_URL.');
    }
    setLoading(false);
  }

  const warningOrders = orders.filter(o => o.riskLevel === 'HIGH' || o.riskLevel === 'OVERDUE' || o.riskLevel === 'NEAR');

  const parseDate = (s: string): Date | null => {
    if (!s || s === '—') return null;
    const parts = s.split('/');
    if (parts.length === 3) { const d = new Date(+parts[2], +parts[1] - 1, +parts[0]); return isNaN(d.getTime()) ? null : d; }
    const d = new Date(s); return isNaN(d.getTime()) ? null : d;
  };
  const dateMs = (s: string) => parseDate(s)?.getTime() ?? Infinity;
  const monthKey = (s: string) => { const d = parseDate(s); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '9999-99'; };
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${BULAN[+m - 1]} ${y}`;
  };

  // Group by month → date → orders
  const monthsMap = new Map<string, Map<string, Order[]>>();
  for (const o of orders) {
    const dk = o.tglSelesai || o.dlCust || '—';
    const mk = monthKey(dk);
    if (!monthsMap.has(mk)) monthsMap.set(mk, new Map());
    const dm = monthsMap.get(mk)!;
    if (!dm.has(dk)) dm.set(dk, []);
    dm.get(dk)!.push(o);
  }
  const sortedMonths = Array.from(monthsMap.keys()).sort();
  const activeMonth = selectedMonth && monthsMap.has(selectedMonth) ? selectedMonth : (sortedMonths[0] ?? '');
  const activeDateMap = monthsMap.get(activeMonth) ?? new Map<string, Order[]>();
  const activeDates = Array.from(activeDateMap.entries()).sort(([a], [b]) => dateMs(a) - dateMs(b));
  const activeMonthOrderCount = Array.from(activeDateMap.values()).reduce((s, arr) => s + arr.length, 0);
  const totalPages = activeMonthOrderCount > ORDER_PAGE_SIZE ? Math.ceil(activeDates.length / ORDER_PAGE_SIZE) : 1;
  const pagedDates = activeMonthOrderCount > ORDER_PAGE_SIZE
    ? activeDates.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE)
    : activeDates;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Order Aktif"
          value={stats ? stats.totalOrders - stats.doneOrders : 0}
          sub={`${stats?.doneOrders ?? 0} selesai`}
          color="indigo"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <StatCard
          label="Near Deadline"
          value={stats?.nearDeadlineCount ?? 0}
          sub="≤ 3 hari lagi"
          color="amber"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard
          label="Overdue"
          value={stats?.overdueCount ?? 0}
          sub="Sudah lewat deadline"
          color="red"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
        />
        <StatCard
          label="Kapasitas Hari Ini"
          value={stats?.dailyCapacityUsed ?? 0}
          sub={`total hari ini`}
          color="green"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage pipeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            Progress Pipeline Produksi
          </h2>
          <div className="space-y-3">
            {STAGES.map(stage => {
              const count = stats?.stageCounts?.[stage.key] ?? 0;
              const maxCount = Math.max(1, ...Object.values(stats?.stageCounts ?? {}));
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-32 shrink-0">{stage.label}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
                </div>
              );
            })}
            {stats?.stageCounts?.['OPEN'] != null && stats.stageCounts['OPEN'] > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-32 shrink-0">Belum mulai</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-300 rounded-full" style={{ width: `${Math.round((stats.stageCounts['OPEN'] / Math.max(1, stats.totalOrders)) * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-8 text-right">{stats.stageCounts['OPEN']}</span>
              </div>
            )}
          </div>

        </div>

        {/* Warning center */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Warning Center
            {warningOrders.length > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                {warningOrders.length}
              </span>
            )}
          </h2>

          {warningOrders.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-sm text-slate-500">Semua order aman</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-72">
              {warningOrders.map(order => (
                <div key={order.rowIndex} className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{order.customer}</p>
                      <p className="text-xs text-slate-500">{order.qty} pcs · {order.paket1} {order.paket2}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${RISK_STYLES[order.riskLevel || 'NORMAL']}`}>
                      {RISK_LABELS[order.riskLevel || 'NORMAL']}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    DL: {formatDate(order.tglSelesai || order.dlCust)}
                    {order.daysLeft != null && (
                      <span className={`ml-2 font-medium ${order.daysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {order.daysLeft < 0 ? `${Math.abs(order.daysLeft)} hari lewat` : `${order.daysLeft} hari lagi`}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders — grouped by month → date */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Order Terbaru</h2>
          <Link href="/orders" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Lihat semua →
          </Link>
        </div>

        {sortedMonths.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">Belum ada data order</div>
        ) : (
          <>
            {/* Month tabs */}
            <div className="px-6 pt-3 pb-0 flex gap-2 overflow-x-auto border-b border-slate-100">
              {sortedMonths.map(mk => (
                <button
                  key={mk}
                  onClick={() => { setSelectedMonth(mk); setOrderPage(1); }}
                  className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
                    ${mk === activeMonth
                      ? 'border-indigo-500 text-indigo-600 bg-indigo-50/60'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  {monthLabel(mk)}
                  <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 tabular-nums
                    ${mk === activeMonth ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {Array.from(monthsMap.get(mk)!.values()).reduce((s, a) => s + a.length, 0)}
                  </span>
                </button>
              ))}
            </div>

            {/* Date rows */}
            <div className="divide-y divide-slate-50">
              {pagedDates.map(([dateKey, dateOrders]) => {
                const totalQty = dateOrders.reduce((s, o) => s + o.qty, 0);
                const RISK_RANK: Record<string, number> = { OVERDUE: 4, HIGH: 3, NEAR: 2, NORMAL: 1, SAFE: 0 };
                const worstRisk = dateOrders.reduce<string>((w, o) => (RISK_RANK[o.riskLevel || 'NORMAL'] > RISK_RANK[w] ? (o.riskLevel || 'NORMAL') : w), 'SAFE');
                const allDone = dateOrders.every(o => o.status === 'DONE');
                const statusSummary = allDone ? 'Selesai' : `${dateOrders.filter(o => o.status !== 'DONE').length} aktif`;
                return (
                  <div key={dateKey} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="w-28 shrink-0 text-sm font-semibold text-slate-700">{formatDate(dateKey)}</div>
                    <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                      {dateOrders.map(o => (
                        <span key={o.rowIndex} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {o.customer} <span className="text-slate-400">{o.qty}</span>
                        </span>
                      ))}
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-slate-600 tabular-nums w-16 text-right">{totalQty} pcs</div>
                    <div className="shrink-0 w-20 text-right">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${allDone ? STATUS_STYLES['DONE'] : STATUS_STYLES['IN_PROGRESS']}`}>
                        {statusSummary}
                      </span>
                    </div>
                    <div className="shrink-0 w-20 text-right">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${RISK_STYLES[worstRisk]}`}>
                        {RISK_LABELS[worstRisk]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination — only when month orders > 8 */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-center">
                <PaginationBar current={orderPage} total={totalPages} onChange={p => setOrderPage(p)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PaginationBar({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages: (number | '...')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  const btn = (label: React.ReactNode, page: number, active = false, disabled = false) => (
    <button
      key={String(label)}
      onClick={() => !disabled && onChange(page)}
      disabled={disabled}
      className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors
        ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {btn('‹ Back', current - 1, false, current === 1)}
      {pages.map((p, i) =>
        p === '...'
          ? <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm select-none">…</span>
          : btn(p, p, p === current)
      )}
      {btn('Next ›', current + 1, false, current === total)}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: number; sub: string; color: string; icon: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse bg-slate-100" />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 h-64 animate-pulse bg-slate-100" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">Gagal Memuat Data</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">{message}</p>
      <button onClick={onRetry} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
        Coba Lagi
      </button>
    </div>
  );
}
