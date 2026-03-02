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
  const capacityPct = stats ? Math.min(100, Math.round((stats.dailyCapacityUsed / 200) * 100)) : 0;

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
          sub={`dari 200 pcs (${capacityPct}%)`}
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

          {/* Capacity bar */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Kapasitas Harian</span>
              <span className="text-sm font-bold text-slate-800">{stats?.dailyCapacityUsed ?? 0} / 200 pcs</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{200 - (stats?.dailyCapacityUsed ?? 0)} pcs slot tersisa hari ini</p>
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

      {/* Recent orders table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Order Terbaru</h2>
          <Link href="/orders" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Lihat semua →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">No</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">TGL Selesai</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.slice(0, 8).map(order => (
                <tr key={order.rowIndex} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-slate-400 font-mono text-xs">{order.no}</td>
                  <td className="px-6 py-3 font-medium text-slate-800">{order.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{order.qty}</td>
                  <td className="px-4 py-3 text-slate-600">{order.paket1} {order.paket2}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.tglSelesai || order.dlCust)}</td>
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
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Belum ada data order</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
