import { Order, Progress, RiskLevel } from './types';
import { STAGES } from './constants';

// ─── Capacity Allocation ─────────────────────────────────
export interface DayAllocation {
  dateKey: string;        // DD/MM/YYYY
  dateDisplay: string;    // "Sen, 2 Mar 2026"
  qty: number;
  pct: number;            // % of 200
  customers: string[];
  isToday: boolean;
  isFull: boolean;
}

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return new Date(+y, +m - 1, +d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toDateKey(d: Date): string {
  const day = d.getDate(), mon = d.getMonth() + 1, yr = d.getFullYear();
  return `${day < 10 ? '0' : ''}${day}/${mon < 10 ? '0' : ''}${mon}/${yr}`;
}

export function computeAllocations(orders: Order[], days = 45): DayAllocation[] {
  const DAILY_CAP = 200;
  const dailyMap: Record<string, { qty: number; customers: Set<string> }> = {};

  const active = orders
    .filter(o => o.status !== 'DONE')
    .sort((a, b) => {
      const da = parseDateStr(a.dpProduksi), db = parseDateStr(b.dpProduksi);
      if (!da && !db) return 0;
      if (!da) return 1; if (!db) return -1;
      return da.getTime() - db.getTime();
    });

  for (const order of active) {
    let remaining = order.qty;
    const start = parseDateStr(order.dpProduksi) || new Date();
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    let safety = 0;
    while (remaining > 0 && safety++ < 365) {
      const key = toDateKey(cur);
      if (!dailyMap[key]) dailyMap[key] = { qty: 0, customers: new Set() };
      const avail = DAILY_CAP - dailyMap[key].qty;
      if (avail > 0) {
        const alloc = Math.min(remaining, avail);
        dailyMap[key].qty += alloc;
        dailyMap[key].customers.add(order.customer);
        remaining -= alloc;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  // Include today + next `days` days AND any future allocated days
  const allKeys = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    allKeys.add(toDateKey(d));
  }
  Object.keys(dailyMap).forEach(k => {
    const d = parseDateStr(k);
    if (d && d >= today) allKeys.add(k);
  });

  return Array.from(allKeys)
    .sort((a, b) => {
      const da = parseDateStr(a)!, db = parseDateStr(b)!;
      return da.getTime() - db.getTime();
    })
    .map(key => {
      const d = parseDateStr(key)!;
      const data = dailyMap[key] || { qty: 0, customers: new Set() };
      return {
        dateKey: key,
        dateDisplay: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
        qty: data.qty,
        pct: Math.min(100, Math.round((data.qty / DAILY_CAP) * 100)),
        customers: Array.from(data.customers),
        isToday: key === todayKey,
        isFull: data.qty >= DAILY_CAP,
      };
    });
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  try {
    // DD/MM/YYYY (spreadsheet format)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      const d = new Date(+year, +month - 1, +day);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    // YYYY-MM-DD (HTML date input)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      const dt = new Date(+y, +m - 1, +d);
      return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    // ISO string or any other date string → try new Date()
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

export function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

export function fromInputDate(inputDate: string): string {
  if (!inputDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    const [year, month, day] = inputDate.split('-');
    return `${day}/${month}/${year}`;
  }
  return inputDate;
}

export function calcDaysLeft(tglSelesai: string, dlCust?: string): number | null {
  const dateStr = tglSelesai || dlCust || '';
  if (!dateStr) return null;
  try {
    let d: Date;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      d = new Date(+year, +month - 1, +day);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - today.getTime()) / 86400000);
  } catch { return null; }
}

export function getStageIndex(progress: Progress): number {
  let last = -1;
  STAGES.forEach((s, i) => {
    if (progress[s.key as keyof Progress]) last = i;
  });
  return last;
}

export function calcRiskLevel(order: Order): RiskLevel {
  if (order.status === 'DONE') return 'SAFE';
  const daysLeft = order.daysLeft;
  if (daysLeft === null || daysLeft === undefined) return 'NORMAL';
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= 3) {
    return getStageIndex(order.progress) <= 5 ? 'HIGH' : 'NEAR';
  }
  return 'NORMAL';
}

export function getProgressPercent(progress: Progress): number {
  const done = STAGES.filter(s => progress[s.key as keyof Progress]).length;
  return Math.round((done / STAGES.length) * 100);
}

export function getCurrentStage(progress: Progress): string {
  const idx = getStageIndex(progress);
  if (idx < 0) return 'Belum mulai';
  return STAGES[idx]?.label || '-';
}
