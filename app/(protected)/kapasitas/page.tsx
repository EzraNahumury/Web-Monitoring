'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce } from '@/lib/api';
import { Order } from '@/lib/types';
import { computeAllocations, computeScheduledAllocations, DayAllocation, NORMAL_CAP, EXTEND_CAP } from '@/lib/utils';

async function generateCapacityPDF(
  allocations: DayAllocation[],
  type: 'weekly' | 'monthly',
  viewYear: number,
  viewMonth: number,
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  let rows: DayAllocation[];
  let title: string;
  let fileName: string;

  const parseKey = (key: string) => {
    const [dd, mm, yy] = key.split('/');
    return new Date(+yy, +mm - 1, +dd);
  };

  if (type === 'monthly') {
    rows = allocations.filter(d => {
      const date = parseKey(d.dateKey);
      return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
    });
    title = `Laporan Kapasitas Harian — ${BULAN_FULL[viewMonth]} ${viewYear}`;
    fileName = `kapasitas-bulanan-${viewYear}-${String(viewMonth + 1).padStart(2, '0')}.pdf`;
  } else {
    const day = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sat = new Date(mon); sat.setDate(mon.getDate() + 12); // 2 weeks: Mon to Sat of next week
    rows = allocations.filter(d => {
      const date = parseKey(d.dateKey);
      return date >= mon && date <= sat;
    });
    const fmtD = (d: Date) => `${d.getDate()} ${BULAN_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    title = `Laporan Kapasitas 2 Mingguan — ${fmtD(mon)} s/d ${fmtD(sat)}`;
    fileName = `kapasitas-2mingguan-${today.getFullYear()}-${String(mon.getDate()).padStart(2,'0')}${BULAN_SHORT[mon.getMonth()]}.pdf`;
  }

  rows = [...rows].sort((a, b) => parseKey(a.dateKey).getTime() - parseKey(b.dateKey).getTime());

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW / 2, 14, { align: 'center' });

  autoTable(doc, {
    startY: 20,
    margin: { left: 14, right: 14 },
    columns: [
      { header: 'TANGGAL', dataKey: 'date' },
      { header: 'TOTAL PCS', dataKey: 'total' },
      { header: 'NORMAL (PCS)', dataKey: 'normal' },
      { header: 'NORMAL (%)', dataKey: 'normalPct' },
      { header: 'EXTEND (PCS)', dataKey: 'extend' },
      { header: 'EXTEND (%)', dataKey: 'extendPct' },
      { header: 'OVER EXTEND', dataKey: 'over' },
      { header: 'STATUS', dataKey: 'status' },
      { header: 'CUSTOMER', dataKey: 'customers' },
    ],
    body: rows.map(d => ({
      date: d.dateDisplay,
      total: d.qty > 0 ? d.qty : '-',
      normal: d.normalQty > 0 ? d.normalQty : '-',
      normalPct: d.normalQty > 0 ? `${d.normalPct}%` : '-',
      extend: d.extendQty > 0 ? d.extendQty : '-',
      extendPct: d.extendQty > 0 ? `${d.extendPct}%` : '-',
      over: d.overExtendQty > 0 ? `+${d.overExtendQty}` : '-',
      status: d.overExtendQty > 0 ? 'OVER' : d.isExtendFull ? 'FULL' : d.isFull ? '+LEMBUR' : d.isNearFull ? 'MENDEKATI' : d.normalQty > 0 ? 'NORMAL' : '-',
      customers: d.customers.join(', ') || '-',
    })),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const v = data.cell.raw;
        if (v === 'OVER') { data.cell.styles.textColor = [124, 58, 237]; data.cell.styles.fontStyle = 'bold'; }
        else if (v === 'FULL') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (v === '+LEMBUR') { data.cell.styles.textColor = [234, 88, 12]; data.cell.styles.fontStyle = 'bold'; }
        else if (v === 'MENDEKATI') { data.cell.styles.textColor = [180, 120, 0]; }
        else if (v === 'NORMAL') { data.cell.styles.textColor = [22, 163, 74]; }
      }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(fileName);
}

export default function KapasitasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed

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

  const [viewDayOffset, setViewDayOffset] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'DONE'), [orders]);
  // Leaderboard: group by dpProduksi (no overflow) — shows what's actually scheduled per day
  const allocations = useMemo(() => computeScheduledAllocations(activeOrders, 60), [activeOrders]);
  const activeAllocations = useMemo(() => allocations.filter(d => d.qty > 0 && !d.isPast), [allocations]);
  // Calendar visualization: overflow-based, all orders (incl. DONE) for historical accuracy
  const allAllocations = useMemo(() => computeAllocations(orders, 60), [orders]);
  const allocMap = useMemo(() => {
    const map: Record<string, DayAllocation> = {};
    allAllocations.forEach(d => { map[d.dateKey] = d; });
    return map;
  }, [allAllocations]);
  // Leaderboard lookup map (scheduled, active orders only)
  const leaderAllocMap = useMemo(() => {
    const map: Record<string, DayAllocation> = {};
    allocations.forEach(d => { map[d.dateKey] = d; });
    return map;
  }, [allocations]);
  const todayAlloc = allocations.find(d => d.isToday);
  const totalActiveOrders = orders.filter(o => o.status !== 'DONE').length;
  const totalPcsQueued = orders.filter(o => o.status !== 'DONE').reduce((s, o) => s + o.qty, 0);
  const daysNeeded = activeAllocations.length;

  const PAST_DAYS = 30; // working days (Mon–Sat) to show before today
  const fullDayList = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Collect past working days newest-first, then reverse to get chronological order
    const pastTemp: DayAllocation[] = [];
    for (let i = 1; pastTemp.length < PAST_DAYS; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (d.getDay() === 0) continue; // skip Sunday
      const key = makeDateKey(d.getDate(), d.getMonth(), d.getFullYear());
      pastTemp.push(leaderAllocMap[key] ?? {
        dateKey: key,
        dateDisplay: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
        qty: 0, pct: 0, normalQty: 0, extendQty: 0, overExtendQty: 0,
        normalPct: 0, extendPct: 0, overExtendPct: 0,
        isNearFull: false, isExtendFull: false, customers: [],
        isToday: false, isFull: false, isPast: true,
      });
    }
    const past = pastTemp.reverse();
    const todayAndFuture = allocations.filter(d => !d.isPast);
    return [...past, ...todayAndFuture];
  }, [leaderAllocMap, allocations]);

  const todayIndex = PAST_DAYS; // always exactly PAST_DAYS entries before today
  const currentIndex = Math.max(0, Math.min(todayIndex + viewDayOffset, fullDayList.length - 1));
  const currentDay = fullDayList[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < fullDayList.length - 1;

  const CHART_WINDOW = 14;
  const [chartOffset, setChartOffset] = useState(() => Math.max(0, PAST_DAYS - 7));
  const chartWindow = useMemo(
    () => fullDayList.slice(chartOffset, chartOffset + CHART_WINDOW),
    [fullDayList, chartOffset]
  );
  const canChartPrev = chartOffset > 0;
  const canChartNext = chartOffset + CHART_WINDOW < fullDayList.length;

  function handleChartDayClick(dateKey: string) {
    const idx = fullDayList.findIndex(d => d.dateKey === dateKey);
    if (idx >= 0) setViewDayOffset(idx - todayIndex);
  }

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

      {/* Leaderboard — admin only */}
      {user?.role !== 'cs' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Leaderboard Kapasitas Harian</h2>
            <p className="text-xs text-slate-400 mt-0.5">Normal 200 pcs/hari · Extend (lembur) maks 100 pcs · Total maks 300 pcs/hari</p>
          </div>
          {!loading && (
            <div className="flex items-center gap-3">
              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportOpen(o => !o)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Export PDF
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[168px]">
                    <button
                      onClick={() => { generateCapacityPDF(allocations, 'weekly', viewYear, viewMonth); setExportOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      Laporan 2 Mingguan
                    </button>
                    <button
                      onClick={() => { generateCapacityPDF(allocations, 'monthly', viewYear, viewMonth); setExportOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      Laporan Bulanan
                    </button>
                  </div>
                )}
              </div>
              {/* Day nav */}
              <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setViewDayOffset(o => o - 1)}
                disabled={!canGoPrev}
                title="Hari sebelumnya"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              >
                ↑
              </button>
              <span className="text-[10px] text-slate-400 font-medium tabular-nums leading-none">
                {viewDayOffset === 0 ? 'hari ini' : viewDayOffset > 0 ? `+${viewDayOffset}` : `${viewDayOffset}`}
              </span>
              <button
                onClick={() => setViewDayOffset(o => o + 1)}
                disabled={!canGoNext}
                title="Hari berikutnya"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              >
                ↓
              </button>
            </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-500">{error}</div>
        ) : !currentDay ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-slate-500 text-sm">Tidak ada order aktif dalam antrian produksi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <DayRow key={currentDay.dateKey} day={currentDay} />
          </div>
        )}
      </div>}

      {/* Capacity chart — admin only */}
      {user?.role !== 'cs' && !loading && (
        <CapacityChart
          days={chartWindow}
          currentDateKey={currentDay?.dateKey}
          onDayClick={handleChartDayClick}
          canPrev={canChartPrev}
          canNext={canChartNext}
          onPrev={() => setChartOffset(o => Math.max(0, o - 1))}
          onNext={() => setChartOffset(o => Math.min(fullDayList.length - CHART_WINDOW, o + 1))}
        />
      )}

      {/* Monthly capacity visualization */}
      {!loading && (
        <MonthlyCapacityView
          viewYear={viewYear}
          viewMonth={viewMonth}
          allocMap={allocMap}
          onPrev={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
            else setViewMonth(m => m - 1);
          }}
          onNext={() => {
            if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
            else setViewMonth(m => m + 1);
          }}
        />
      )}
    </div>
  );
}

function getDayColor(day: DayAllocation): { border: string } {
  if (!day || day.normalQty === 0) return { border: 'border-l-slate-200' };
  if (day.normalQty >= 200 && day.extendQty > 0) return { border: 'border-l-orange-400' };
  if (day.normalQty >= 200) return { border: 'border-l-red-500' };
  if (day.normalQty >= 150) return { border: 'border-l-amber-400' };
  if (day.normalQty >= 100) return { border: 'border-l-emerald-400' };
  if (day.normalQty >= 50) return { border: 'border-l-emerald-300' };
  return { border: 'border-l-emerald-200' };
}

function DayRow({ day }: { day: DayAllocation }) {
  const { border } = getDayColor(day);

  const normalBarColor =
    day.normalQty === 0 ? 'bg-slate-200' :
    day.normalQty < 150 ? 'bg-emerald-500' :
    day.normalQty < 200 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={`pl-5 pr-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-l-4 ${border} ${day.isToday ? 'bg-indigo-50/60' : ''}`}>
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

          {/* Over Extend bar */}
          {day.overExtendQty > 0 && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs text-purple-500 font-medium">Over</span>
                <span className="ml-auto text-xs font-bold tabular-nums text-purple-700">
                  +{day.overExtendQty}
                </span>
              </div>
              <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-purple-500"
                  style={{ width: `${day.overExtendPct}%` }}
                />
              </div>
            </div>
          )}
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
        {day.overExtendQty > 0 ? (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">OVER</span>
        ) : day.isExtendFull ? (
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

const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function makeDateKey(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
}

function MonthlyCapacityView({
  viewYear, viewMonth, allocMap, onPrev, onNext,
}: {
  viewYear: number;
  viewMonth: number;
  allocMap: Record<string, DayAllocation>;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800">Visualisasi Kapasitas</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-slate-700 w-36 text-center">
            {MONTHS_FULL[viewMonth]} {viewYear}
          </span>
          <button
            onClick={onNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Day boxes */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const key = makeDateKey(day, viewMonth, viewYear);
          const alloc = allocMap[key];
          const isToday = day === todayD && viewMonth === todayM && viewYear === todayY;
          const isSunday = new Date(viewYear, viewMonth, day).getDay() === 0;

          const bg = isSunday
            ? 'bg-slate-50 text-slate-300'
            : !alloc || alloc.normalQty === 0
            ? 'bg-slate-100 text-slate-400'
            : alloc.normalQty < 50
            ? 'bg-emerald-100 text-emerald-700'
            : alloc.normalQty < 100
            ? 'bg-emerald-200 text-emerald-800'
            : alloc.normalQty < 150
            ? 'bg-emerald-300 text-emerald-900'
            : alloc.normalQty < 200
            ? 'bg-amber-300 text-amber-900'
            : alloc.extendQty > 0
            ? 'bg-orange-400 text-white'
            : 'bg-red-500 text-white';

          const tooltip = isSunday
            ? `${day} ${MONTHS_FULL[viewMonth]} ${viewYear}\nLibur (Minggu)`
            : alloc && alloc.normalQty > 0
            ? `${day} ${MONTHS_FULL[viewMonth]} ${viewYear}\nNormal: ${alloc.normalQty}/${NORMAL_CAP}${alloc.extendQty > 0 ? `\nExtend: ${alloc.extendQty}/${EXTEND_CAP}` : ''}${alloc.customers.length ? '\n' + alloc.customers.join(', ') : ''}`
            : `${day} ${MONTHS_FULL[viewMonth]} ${viewYear}\nKosong`;

          return (
            <div
              key={day}
              title={tooltip}
              onMouseEnter={() => !isSunday && setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              className={`
                relative w-12 h-12 rounded-xl flex flex-col items-center justify-center select-none
                ${isSunday ? 'cursor-default opacity-50' : 'cursor-default transition-transform hover:scale-110 hover:shadow-md'}
                ${bg}
                ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                ${hovered === key ? 'z-10' : ''}
              `}
            >
              <span className="text-sm font-bold leading-none">{day}</span>
              {alloc && alloc.normalQty > 0 && (
                <span className="text-[9px] leading-none mt-0.5 opacity-80 font-medium">
                  {alloc.normalQty}
                  {alloc.extendQty > 0 ? `+${alloc.extendQty}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 inline-block border border-slate-200" /> Kosong</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> 1–149</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300 inline-block" /> 150–199</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Normal penuh 200</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> + Extend/lembur</span>
        <span className="ml-auto">Hover kotak untuk lihat detail · <span className="inline-block w-2.5 h-2.5 rounded ring-2 ring-indigo-500 bg-slate-100 align-middle" /> = hari ini</span>
      </div>
    </div>
  );
}

const BAR_H = 128; // px, fixed bar column height

function CapacityChart({
  days,
  currentDateKey,
  onDayClick,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  days: DayAllocation[];
  currentDateKey?: string;
  onDayClick: (dateKey: string) => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const maxQty = Math.max(...days.map(d => d.qty), NORMAL_CAP + EXTEND_CAP);
  const normalLineY = BAR_H - (NORMAL_CAP / maxQty) * BAR_H;
  const extendLineY = BAR_H - ((NORMAL_CAP + EXTEND_CAP) / maxQty) * BAR_H;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800">Chart Kapasitas Harian</h3>
          <p className="text-xs text-slate-400 mt-0.5">Klik bar untuk lihat detail hari tersebut</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={!canPrev}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >‹</button>
          <button
            onClick={onNext}
            disabled={!canNext}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >›</button>
        </div>
      </div>

      <div>
        <div className="flex items-end gap-1.5 pb-1">
          {/* Y-axis reference lines overlay */}
          {days.map(day => {
            const isCurrent = day.dateKey === currentDateKey;
            const totalPct = day.qty > 0 ? (day.qty / maxQty) * 100 : 0;
            const normalPctOfBar = day.qty > 0 ? (day.normalQty / day.qty) * 100 : 0;
            const extendPctOfBar = day.qty > 0 ? (day.extendQty / day.qty) * 100 : 0;
            const overPctOfBar = day.qty > 0 ? (day.overExtendQty / day.qty) * 100 : 0;
            const normalBarColor =
              day.normalQty === 0 ? '' :
              day.normalQty < 150 ? 'bg-emerald-400' :
              day.normalQty < 200 ? 'bg-amber-400' : 'bg-red-500';
            const parts = day.dateDisplay.split(', ');
            const dayName = parts[0] ?? '';
            const dayNum = (parts[1] ?? '').split(' ')[0] ?? '';
            const monthName = (parts[1] ?? '').split(' ')[1] ?? '';

            return (
              <div key={day.dateKey} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {/* Bar column */}
                <button
                  onClick={() => onDayClick(day.dateKey)}
                  title={`${day.dateDisplay}: ${day.qty} pcs`}
                  className={`relative w-full rounded-t overflow-hidden bg-slate-100 hover:opacity-80 transition-opacity ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} ${day.isToday && !isCurrent ? 'ring-2 ring-indigo-200 ring-offset-1' : ''}`}
                  style={{ height: `${BAR_H}px` }}
                >
                  {/* Reference line Normal cap */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none z-10"
                    style={{ top: `${normalLineY}px` }}
                  />
                  {/* Reference line Extend cap */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-orange-200 pointer-events-none z-10"
                    style={{ top: `${extendLineY}px` }}
                  />
                  {/* Filled bar from bottom */}
                  {day.qty > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0"
                      style={{ height: `${totalPct}%` }}
                    >
                      {day.normalQty > 0 && (
                        <div
                          className={`absolute bottom-0 left-0 right-0 ${normalBarColor}`}
                          style={{ height: `${normalPctOfBar}%` }}
                        />
                      )}
                      {day.extendQty > 0 && (
                        <div
                          className="absolute left-0 right-0 bg-orange-400"
                          style={{ bottom: `${normalPctOfBar}%`, height: `${extendPctOfBar}%` }}
                        />
                      )}
                      {day.overExtendQty > 0 && (
                        <div
                          className="absolute left-0 right-0 bg-purple-500"
                          style={{ bottom: `${normalPctOfBar + extendPctOfBar}%`, height: `${overPctOfBar}%` }}
                        />
                      )}
                    </div>
                  )}
                </button>

                {/* Labels */}
                <span className={`text-[9px] leading-none font-semibold ${isCurrent ? 'text-indigo-600' : day.isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {dayName}
                </span>
                <span className={`text-[9px] leading-none tabular-nums ${isCurrent ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                  {dayNum}
                </span>
                <span className="text-[8px] leading-none text-slate-300">{monthName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" /> Extend</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> Over</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-1 border-t-2 border-dashed border-slate-300" /> Normal cap (200)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-1 border-t-2 border-dashed border-orange-200" /> Extend cap (300)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm ring-2 ring-indigo-500 bg-slate-100" /> Dipilih</span>
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
