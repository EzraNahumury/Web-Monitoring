'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiAddOrder } from '@/lib/api';
import { PAKET1_OPTIONS, PAKET2_OPTIONS } from '@/lib/constants';
import { fromInputDate, formatDate } from '@/lib/utils';

interface FormData {
  customer: string;
  qty: string;
  paket1: string;
  paket2: string;
  keterangan: string;
  bahan: string;
  dpProduksi: string;
  dlCust: string;
}

const EMPTY: FormData = {
  customer: '', qty: '', paket1: 'PRO', paket2: 'A',
  keterangan: '', bahan: '', dpProduksi: '', dlCust: '',
};

export default function NewOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ noWO: string; tglSelesai: string } | null>(null);

  useEffect(() => {
    if (user && user.role === 'produksi') {
      router.replace('/production');
    }
  }, [user]);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer.trim()) { setError('Customer wajib diisi'); return; }
    if (!form.qty || Number(form.qty) <= 0) { setError('Qty harus lebih dari 0'); return; }
    if (!form.dpProduksi) { setError('Tanggal DP Produksi wajib diisi'); return; }
    if (!form.dlCust) { setError('Deadline Customer wajib diisi'); return; }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        customer: form.customer.trim(),
        qty: Number(form.qty),
        paket1: form.paket1,
        paket2: form.paket2,
        keterangan: form.keterangan.trim(),
        bahan: form.bahan.trim(),
        dpProduksi: fromInputDate(form.dpProduksi),
        dlCust: fromInputDate(form.dlCust),
      };
      const res = await apiAddOrder(payload);
      if (res.success && res.data) {
        setSuccess({ noWO: res.data.noWorkOrder, tglSelesai: res.data.tglSelesai });
        setForm(EMPTY);
      } else {
        setError(res.error || 'Gagal menyimpan order');
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Order Berhasil Disimpan!</h2>
          <p className="text-slate-500 mb-6 text-sm">Order telah ditambahkan ke sistem dan spreadsheet.</p>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">No. Work Order</span>
              <span className="text-sm font-bold text-indigo-600 font-mono">{success.noWO}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Estimasi Selesai</span>
              <span className="text-sm font-bold text-slate-800">{formatDate(success.tglSelesai)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setSuccess(null)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Input Order Lagi
            </button>
            <button
              onClick={() => router.push('/orders')}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Lihat Semua Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Form Input Order Baru
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Isi data order, sistem akan otomatis menghitung tanggal estimasi selesai</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer + Qty */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Customer <Required /></Label>
              <input
                type="text"
                value={form.customer}
                onChange={set('customer')}
                placeholder="Nama customer"
                className={inputCls}
                required
              />
            </div>
            <div>
              <Label>Qty (pcs) <Required /></Label>
              <input
                type="number"
                value={form.qty}
                onChange={set('qty')}
                placeholder="0"
                min={1}
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Paket */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Paket 1 (Jenis Produk) <Required /></Label>
              <select value={form.paket1} onChange={set('paket1')} className={inputCls}>
                {PAKET1_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <Label>Paket 2 (Grade) <Required /></Label>
              <select value={form.paket2} onChange={set('paket2')} className={inputCls}>
                {PAKET2_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Bahan + Keterangan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bahan</Label>
              <input
                type="text"
                value={form.bahan}
                onChange={set('bahan')}
                placeholder="Jenis bahan"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Keterangan</Label>
              <input
                type="text"
                value={form.keterangan}
                onChange={set('keterangan')}
                placeholder="Keterangan tambahan"
                className={inputCls}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>DP Produksi (Tanggal Mulai) <Required /></Label>
              <input
                type="date"
                value={form.dpProduksi}
                onChange={set('dpProduksi')}
                className={inputCls}
                required
              />
            </div>
            <div>
              <Label>Deadline Customer <Required /></Label>
              <input
                type="date"
                value={form.dlCust}
                onChange={set('dlCust')}
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
            <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="text-xs text-indigo-600">
              <strong>Auto Scheduling:</strong> Sistem akan otomatis mengalokasikan produksi berdasarkan kapasitas 200 pcs/hari dan menghitung Tanggal Estimasi Selesai (alokasi terakhir + 14 hari).
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Menyimpan...
                </span>
              ) : 'Simpan Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1.5">{children}</label>;
}
function Required() {
  return <span className="text-red-500 ml-0.5">*</span>;
}
