'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce } from '@/lib/api';
import { Order } from '@/lib/types';
import { computeAllocations, DayAllocation, NORMAL_CAP, EXTEND_CAP } from '@/lib/utils';

export default function KapasitasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'cs') router.replace('/dashboard');
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
          value={todayAlloc?.normalQty ?? 0}
          sub={`normal ${todayAlloc?.normalPct ?? 0}% · extend ${todayAlloc?.extendQty ?? 0} pcs`}
          color={!todayAlloc || todayAlloc.normalQty === 0 ? 'green' : todayAlloc.isExtendFull ? 'red' : todayAlloc.isFull ? 'orange' : todayAlloc.isNearFull ? 'amber' : 'green'}
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
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Normal 1–149</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> ⚠ Mendekati penuh 150–199</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Normal penuh 200</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Extend/lembur (maks 100)</span>
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
            <p className="text-xs text-slate-400 mt-0.5">Normal 200 pcs/hari · Extend (lembur) maks 100 pcs · Total maks 300 pcs/hari</p>
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
              const intensity = day.normalQty === 0 ? 'bg-slate-100' :
                day.normalQty < 50 ? 'bg-emerald-200' :
                day.normalQty < 100 ? 'bg-emerald-300' :
                day.normalQty < 150 ? 'bg-emerald-400' :
                day.normalQty < 200 ? 'bg-amber-400' :
                day.extendQty > 0 ? 'bg-orange-400' : 'bg-red-500';
              return (
                <div
                  key={day.dateKey}
                  title={`${day.dateDisplay}: ${day.normalQty}/${NORMAL_CAP} normal${day.extendQty > 0 ? ` + ${day.extendQty}/${EXTEND_CAP} extend` : ''}${day.customers.length ? '\n' + day.customers.join(', ') : ''}`}
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
  const normalBarColor =
    day.normalQty === 0 ? 'bg-slate-200' :
    day.normalQty < 150 ? 'bg-emerald-500' :
    day.normalQty < 200 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${day.isToday ? 'bg-indigo-50/60' : ''}`}>
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        <span className="text-xs font-bold text-slate-400">#{rank}</span>
      </div>

      {/* Date */}
      <div className="w-32 shrink-0">
        <div className={`text-sm font-semibold ${day.isToday ? 'text-indigo-700' : 'text-slate-700'}`}>
          {day.dateDisplay}
          {day.isToday && <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">Hari ini</span>}
        </div>
      </div>

      {/* Dual bars */}
      <div className="flex-1 min-w-0">
        <div className="flex gap-3 items-end">
          {/* Normal bar */}
          <div className="flex-[2] min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-slate-400 font-medium">Normal</span>
              {day.isNearFull && (
                <span title="Mendekati kapasitas penuh" className="text-xs leading-none">⚠️</span>
              )}
              <span className={`ml-auto text-xs font-bold tabular-nums ${day.isFull ? 'text-red-600' : day.isNearFull ? 'text-amber-600' : 'text-slate-600'}`}>
                {day.normalQty}/{NORMAL_CAP}
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${normalBarColor}`}
                style={{ width: `${day.normalPct}%` }}
              />
            </div>
          </div>

          {/* Extend bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-slate-400 font-medium">Extend</span>
              <span className={`ml-auto text-xs font-bold tabular-nums ${day.isExtendFull ? 'text-red-600' : day.extendQty > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                {day.extendQty}/{EXTEND_CAP}
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${day.extendQty > 0 ? (day.isExtendFull ? 'bg-red-400' : 'bg-orange-400') : ''}`}
                style={{ width: `${day.extendPct}%` }}
              />
            </div>
          </div>
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

      {/* Status badge */}
      <div className="w-20 text-right shrink-0">
        {day.isExtendFull ? (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">FULL</span>
        ) : day.isFull ? (
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-semibold">+ Lembur</span>
        ) : day.normalQty === 0 ? null : (
          <span className="text-xs text-slate-400">{NORMAL_CAP - day.normalQty} sisa</span>
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
    orange: 'bg-orange-50 border-orange-100',
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
