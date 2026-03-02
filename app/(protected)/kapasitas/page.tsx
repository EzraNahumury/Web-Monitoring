'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce } from '@/lib/api';
import { Order } from '@/lib/types';
import { computeAllocations, DayAllocation } from '@/lib/utils';

const DAILY_CAP = 200;

export default function KapasitasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard');
    else loadData(false);
  }, [user]);

  async function loadData(force: boolean) {
    try {
      const res = force ? await apiGetOrdersForce() : await apiGetOrders();
      if (res.success && res.data) { setOrders(res.data); setError(''); }
      else setError(res.error || 'Gagal memuat data');
    } catch { setError('Gagal terhubung ke server'); }
    setLoading(false);
    setRefreshing(false);
  }

  const allocations = useMemo(() => computeAllocations(orders, 60), [orders]);
  const activeAllocations = useMemo(() => allocations.filter(d => d.qty > 0), [allocations]);
  const todayAlloc = allocations.find(d => d.isToday);
  const totalActiveOrders = orders.filter(o => o.status !== 'DONE').length;
  const totalPcsQueued = orders.filter(o => o.status !== 'DONE').reduce((s, o) => s + o.qty, 0);
  const daysNeeded = activeAllocations.length;

  const displayed = showAll ? activeAllocations : activeAllocations.slice(0, 14);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Order Aktif"
          value={totalActiveOrders}
          sub="dalam antrian"
          color="indigo"
          icon="📋"
        />
        <SummaryCard
          label="Total Pcs Antrian"
          value={totalPcsQueued}
          sub="belum selesai"
          color="blue"
          icon="👕"
        />
        <SummaryCard
          label="Kapasitas Hari Ini"
          value={todayAlloc?.qty ?? 0}
          sub={`dari ${DAILY_CAP} pcs (${todayAlloc?.pct ?? 0}%)`}
          color={!todayAlloc || todayAlloc.qty === 0 ? 'green' : todayAlloc.pct >= 100 ? 'red' : todayAlloc.pct >= 75 ? 'amber' : 'green'}
          icon="📅"
        />
        <SummaryCard
          label="Hari Produksi"
          value={daysNeeded}
          sub="hari terisi"
          color="purple"
          icon="🗓️"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 inline-block" /> 0 pcs</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> 1–149 pcs</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> 150–199 pcs</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 200 pcs (penuh)</span>
        <div className="ml-auto">
          <button
            onClick={() => { setRefreshing(true); loadData(true); }}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Leaderboard Kapasitas Harian</h2>
            <p className="text-xs text-slate-400 mt-0.5">Kapasitas 200 pcs/hari · Overflow otomatis ke hari berikutnya</p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-500">{error}</div>
        ) : activeAllocations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-slate-500 text-sm">Tidak ada order aktif dalam antrian produksi</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {displayed.map((day, idx) => (
                <DayRow key={day.dateKey} day={day} rank={idx + 1} />
              ))}
            </div>

            {activeAllocations.length > 14 && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {showAll ? 'Tampilkan lebih sedikit ↑' : `Lihat ${activeAllocations.length - 14} hari lainnya ↓`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mini calendar heatmap */}
      {!loading && activeAllocations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Visualisasi Kapasitas</h3>
          <div className="flex flex-wrap gap-1.5">
            {allocations.slice(0, 60).map(day => {
              const intensity = day.qty === 0 ? 'bg-slate-100' :
                day.qty < 50 ? 'bg-emerald-200' :
                day.qty < 100 ? 'bg-emerald-300' :
                day.qty < 150 ? 'bg-emerald-400' :
                day.qty < 200 ? 'bg-amber-400' : 'bg-red-500';
              return (
                <div
                  key={day.dateKey}
                  title={`${day.dateDisplay}: ${day.qty}/${DAILY_CAP} pcs${day.customers.length ? '\n' + day.customers.join(', ') : ''}`}
                  className={`w-7 h-7 rounded-md cursor-default transition-transform hover:scale-125 ${intensity} ${day.isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">Hover kotak untuk lihat detail · Biru = hari ini</p>
        </div>
      )}
    </div>
  );
}

function DayRow({ day, rank }: { day: DayAllocation; rank: number }) {
  const barColor = day.qty === 0 ? 'bg-slate-200' :
    day.qty < 150 ? 'bg-emerald-500' :
    day.qty < 200 ? 'bg-amber-500' : 'bg-red-500';

  const sisa = DAILY_CAP - day.qty;

  return (
    <div className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${day.isToday ? 'bg-indigo-50/60' : ''}`}>
      {/* Rank / date */}
      <div className="w-8 text-center">
        <span className="text-xs font-bold text-slate-400">#{rank}</span>
      </div>

      {/* Date info */}
      <div className="w-36 shrink-0">
        <div className={`text-sm font-semibold ${day.isToday ? 'text-indigo-700' : 'text-slate-700'}`}>
          {day.dateDisplay}
          {day.isToday && <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">Hari ini</span>}
        </div>
      </div>

      {/* Bar */}
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${day.pct}%` }}
            />
          </div>
          <span className={`text-sm font-bold tabular-nums w-24 text-right shrink-0 ${day.isFull ? 'text-red-600' : day.qty >= 150 ? 'text-amber-600' : 'text-slate-700'}`}>
            {day.qty} / {DAILY_CAP}
          </span>
        </div>

        {/* Customer tags */}
        {day.customers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {day.customers.map(c => (
              <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Sisa */}
      <div className="w-24 text-right shrink-0">
        {day.isFull ? (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">PENUH</span>
        ) : (
          <span className="text-xs text-slate-400">{sisa} sisa</span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color, icon }: {
  label: string; value: number; sub: string; color: string; icon: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-100',
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
    red: 'bg-red-50 border-red-100',
    purple: 'bg-purple-50 border-purple-100',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] || colors.indigo}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-slate-800 mb-0.5">{value.toLocaleString()}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
