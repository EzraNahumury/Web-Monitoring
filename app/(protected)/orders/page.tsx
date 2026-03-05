'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiGetOrders, apiGetOrdersForce, apiUpdateOrder } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { STAGES, RISK_STYLES, RISK_LABELS, STATUS_STYLES, STATUS_LABELS } from '@/lib/constants';
import { formatDate, getProgressPercent, getCurrentStage } from '@/lib/utils';

async function generateOrderPDF(orders: Order[], type: 'weekly' | 'monthly', parseMonthKey: (s: string) => string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  let reportOrders: Order[];
  let title: string;
  let fileName: string;

  if (type === 'monthly') {
    const yr = today.getFullYear(), mo = today.getMonth();
    const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    reportOrders = orders.filter(o => parseMonthKey(o.tglSelesai || o.dlCust || '') === key);
    title = `CRM AYRES ${BULAN_FULL[mo].toUpperCase()} ${yr}`;
    fileName = `laporan-bulanan-${yr}-${String(mo + 1).padStart(2, '0')}.pdf`;
  } else {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 12); // 2 weeks: Mon to Sat of next week
    reportOrders = orders.filter(o => {
      const dateStr = o.dpProduksi || '';
      if (!dateStr) return false;
      let d: Date;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [dd, mm, yy] = dateStr.split('/');
        d = new Date(+yy, +mm - 1, +dd);
      } else {
        d = new Date(dateStr);
      }
      return !isNaN(d.getTime()) && d >= mon && d <= sat;
    });
    const fmtD = (d: Date) => `${d.getDate()} ${BULAN_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    title = `CRM AYRES 2 MINGGUAN ${fmtD(mon)} - ${fmtD(sat)}`;
    fileName = `laporan-2mingguan-${today.getFullYear()}-${String(mon.getDate()).padStart(2,'0')}${BULAN_SHORT[mon.getMonth()]}.pdf`;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW / 2, 14, { align: 'center' });

  const chk = (v: boolean) => v ? '✓' : '-';

  autoTable(doc, {
    startY: 20,
    margin: { left: 8, right: 8 },
    columns: [
      { header: 'NO', dataKey: 'no' },
      { header: 'CUSTOMER', dataKey: 'customer' },
      { header: 'QTY', dataKey: 'qty' },
      { header: 'PAKET', dataKey: 'paket' },
      { header: 'KETERANGAN', dataKey: 'ket' },
      { header: 'BAHAN', dataKey: 'bahan' },
      { header: 'DP PRODUKSI', dataKey: 'dp' },
      { header: 'DL CUST & PRODUKSI', dataKey: 'dl' },
      { header: 'NO WORK ORDER', dataKey: 'wo' },
      { header: 'PROOFING', dataKey: 'p1' },
      { header: 'WAITINGLIST', dataKey: 'p2' },
      { header: 'PRINT', dataKey: 'p3' },
      { header: 'PRES', dataKey: 'p4' },
      { header: 'CUT FABRIC', dataKey: 'p5' },
      { header: 'JAHIT', dataKey: 'p6' },
      { header: 'QC JAHIT DAN STEAM', dataKey: 'p7' },
      { header: 'FINISHING', dataKey: 'p8' },
      { header: 'PENGIRIMAN', dataKey: 'p9' },
    ],
    body: reportOrders.map((o, i) => ({
      no: i + 1,
      customer: o.customer,
      qty: o.qty,
      paket: `${o.paket1} ${o.paket2}`,
      ket: o.keterangan || '-',
      bahan: o.bahan || '-',
      dp: formatDate(o.dpProduksi),
      dl: formatDate(o.dlCust),
      wo: o.noWorkOrder || '-',
      p1: chk(o.progress.PROOFING),
      p2: chk(o.progress.WAITINGLIST),
      p3: chk(o.progress.PRINT),
      p4: chk(o.progress.PRES),
      p5: chk(o.progress.CUT_FABRIC),
      p6: chk(o.progress.JAHIT),
      p7: chk(o.progress.QC_JAHIT_STEAM),
      p8: chk(o.progress.FINISHING),
      p9: chk(o.progress.PENGIRIMAN),
    })),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
    didParseCell: (data) => {
      if (data.column.index >= 9 && data.section === 'body') {
        if (data.cell.raw === '\u2713') {
          data.cell.text = ['']; // clear text, drawn manually in didDrawCell
        } else {
          data.cell.styles.textColor = [200, 200, 200];
        }
      }
    },
    didDrawCell: (data) => {
      if (data.column.index >= 9 && data.section === 'body' && data.cell.raw === '\u2713') {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        const s = 1.6;
        data.doc.setDrawColor(22, 163, 74);
        data.doc.setLineWidth(0.55);
        // left stroke (short, going down-right)
        data.doc.line(cx - s, cy + s * 0.05, cx - s * 0.15, cy + s * 0.85);
        // right stroke (long, going up-right)
        data.doc.line(cx - s * 0.15, cy + s * 0.85, cx + s, cy - s * 0.75);
        data.doc.setDrawColor(0);
        data.doc.setLineWidth(0.2);
      }
    },
    columnStyles: {
      0:  { cellWidth: 7 },
      1:  { cellWidth: 22 },
      2:  { cellWidth: 8, halign: 'center' },
      3:  { cellWidth: 14, halign: 'center' },
      4:  { cellWidth: 28 },
      5:  { cellWidth: 14 },
      6:  { cellWidth: 17, halign: 'center' },
      7:  { cellWidth: 20, halign: 'center' },
      8:  { cellWidth: 17 },
      9:  { cellWidth: 14, halign: 'center' },
      10: { cellWidth: 15, halign: 'center' },
      11: { cellWidth: 11, halign: 'center' },
      12: { cellWidth: 9,  halign: 'center' },
      13: { cellWidth: 15, halign: 'center' },
      14: { cellWidth: 10, halign: 'center' },
      15: { cellWidth: 18, halign: 'center' },
      16: { cellWidth: 13, halign: 'center' },
      17: { cellWidth: 14, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(fileName);
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selected, setSelected] = useState<Order | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

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

  const parseMonthKey = (s: string) => {
    if (!s) return '';
    const parts = s.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    const d = new Date(s); return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${BULAN[+m - 1]} ${y}`;
  };

  const sortedMonths = useMemo(() => {
    const keys = new Set(orders.map(o => parseMonthKey(o.tglSelesai || o.dlCust || '')).filter(Boolean));
    return Array.from(keys).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !search || o.customer.toLowerCase().includes(search.toLowerCase()) ||
        o.noWorkOrder?.toLowerCase().includes(search.toLowerCase()) ||
        o.keterangan?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchRisk = riskFilter === 'ALL' || o.riskLevel === riskFilter;
      const matchMonth = !monthFilter || parseMonthKey(o.tglSelesai || o.dlCust || '') === monthFilter;
      return matchSearch && matchStatus && matchRisk && matchMonth;
    });
  }, [orders, search, statusFilter, riskFilter, monthFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, riskFilter, monthFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <div className="relative">
              <button
                onClick={() => setExportOpen(o => !o)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Export PDF
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[168px]">
                  <button
                    onClick={() => { generateOrderPDF(orders, 'weekly', parseMonthKey); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Laporan 2 Mingguan
                  </button>
                  <button
                    onClick={() => { generateOrderPDF(orders, 'monthly', parseMonthKey); setExportOpen(false); }}
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
          )}
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

      {/* Month tabs */}
      {sortedMonths.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setMonthFilter('')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
              ${!monthFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
          >
            Semua
          </button>
          {sortedMonths.map(mk => {
            const count = orders.filter(o => parseMonthKey(o.tglSelesai || o.dlCust || '') === mk).length;
            return (
              <button
                key={mk}
                onClick={() => setMonthFilter(mk)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                  ${monthFilter === mk ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
              >
                {monthLabel(mk)}
                <span className={`ml-1.5 text-xs tabular-nums ${monthFilter === mk ? 'opacity-80' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
              {paged.map(order => (
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
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 tabular-nums">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length} order
            </span>
            <OrderPaginationBar current={page} total={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} canEdit={user?.role === 'cs'} onSaved={fetchOrders} />
      )}
    </div>
  );
}

function OrderPaginationBar({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
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
  const btn = (label: React.ReactNode, p: number, active = false, disabled = false) => (
    <button key={String(label)} onClick={() => !disabled && onChange(p)} disabled={disabled}
      className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors
        ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1">
      {btn('‹ Back', current - 1, false, current === 1)}
      {pages.map((p, i) => p === '...'
        ? <span key={`el-${i}`} className="px-1 text-slate-400 text-sm select-none">…</span>
        : btn(p, p, p === current))}
      {btn('Next ›', current + 1, false, current === total)}
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
