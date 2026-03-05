# Produksi Manager — AYRES System

Sistem manajemen produksi berbasis web terintegrasi dengan Google Sheets. CS input order, tim produksi update progress tahapan, admin memantau seluruh operasi secara real-time.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | Google Apps Script (Web App) |
| Database | Google Sheets |
| Auth | Session-based (localStorage) |
| PDF Export | jsPDF + jspdf-autotable |

---

## Fitur per Role

| Fitur | Admin | CS | Produksi |
|-------|:-----:|:--:|:--------:|
| Dashboard ringkasan | ✅ | ❌ | ❌ |
| Lihat semua order | ✅ | ✅ | ✅ |
| Input order baru | ❌ | ✅ | ❌ |
| Edit detail order | ❌ | ✅ | ❌ |
| Update progress / stage | ❌ | ❌ | ✅ |
| Jadwal kapasitas produksi | ✅ | ✅ | ❌ |
| Leaderboard & chart kapasitas | ✅ | ❌ | ❌ |
| Export PDF laporan order | ✅ | ❌ | ❌ |
| Export PDF laporan kapasitas | ✅ | ❌ | ❌ |
| Work board produksi | ❌ | ❌ | ✅ |

---

## Akun Login

Gunakan kredensial berikut untuk login:

- Admin: `username: admin` | `password: admin`
- Customer Service: `username: cs` | `password: cs`
- Produksi: `username: produksi` | `password: produksi`

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | Admin |
| `cs` | `cs` | Customer Service |
| `produksi` | `produksi` | Produksi |

---

## Spreadsheet

Link: `https://docs.google.com/spreadsheets/d/1OLGa2zlbGp9cfKl5TP6kX_UeWg9GWRBpHGVEI7WOVUU/edit`

### Struktur Kolom — Sheet1 (data mulai baris 5)

| Kolom | Header | Keterangan |
|-------|--------|------------|
| A | NO | Nomor urut order |
| B | CUSTOMER | Nama customer |
| C | QTY | Jumlah pcs |
| D | PAKET 1 | Jenis produk (PRO, KLASIK, dll) |
| E | PAKET 2 | Grade (A / B / C / D / E / BASIC) |
| F | KETERANGAN | Catatan order |
| G | BAHAN | Jenis bahan |
| H | DP PRODUKSI | Tanggal mulai produksi |
| I | DL CUST | Deadline dari customer |
| J | TGL SELESAI | Estimasi selesai — dihitung otomatis |
| K | NO WORK ORDER | Kode WO — digenerate otomatis |
| L | PROOFING | Checkbox stage |
| M | WAITINGLIST | Checkbox stage |
| N | PRINT | Checkbox stage |
| O | PRES | Checkbox stage |
| P | CUT FABRIC | Checkbox stage |
| Q | JAHIT | Checkbox stage |
| R | JAHIT DAN STEAM | Checkbox stage |
| S | FINISHING | Checkbox stage |
| T | PENGIRIMAN | Checkbox stage |
| U | STATUS | `OPEN` / `IN_PROGRESS` / `DONE` |
| V | TGL KIRIM | Tanggal kirim aktual |

---

## Logika Bisnis

### No Work Order
Format: `WO[YY][MM]-[NNN]`

Contoh: `WO2603-001` = order ke-1, Maret 2026

### Auto Scheduling (TGL SELESAI)
- Kapasitas produksi: **200 pcs/hari** (normal) + **100 pcs/hari** (extend/lembur) = maks **300 pcs/hari**
- Sistem mengalokasikan qty order ke slot hari yang tersedia secara berurutan
- TGL SELESAI = hari alokasi terakhir + **14 hari buffer**

### Halaman Kapasitas (`/kapasitas`)

Halaman ini terdiri dari dua komponen utama yang menggunakan **sumber data berbeda**:

#### 1. Leaderboard Kapasitas Harian
- **Sumber data:** hanya order **aktif** (status `OPEN` / `IN_PROGRESS`)
- **Fungsi:** menampilkan **antrian produksi yang masih perlu dikerjakan**
- Menampilkan **1 hari sekaligus** — default = hari ini
- Navigasi dengan tombol **↑ (hari sebelumnya)** dan **↓ (hari berikutnya)**, bisa scroll hingga 30 hari ke belakang
- Qty setiap order dihitung **tepat di tanggal dpProduksi-nya** (tidak overflow ke hari berikutnya)
- Jika total melebihi 300 pcs, muncul bar ke-3 **Over Extend** (ungu) dengan badge **OVER**
- Tombol **Export PDF** (admin only) — tersedia dua pilihan laporan:
  - **Laporan Mingguan:** semua hari di minggu berjalan (Senin–Sabtu)
  - **Laporan Bulanan:** semua hari di bulan yang sedang ditampilkan di kalender

**Tampilan bar per hari:**

| Bar | Kapasitas | Warna |
|-----|-----------|-------|
| Normal | 0–200 pcs | Hijau / Kuning / Merah |
| Extend | 201–300 pcs (+100 lembur) | Oranye |
| Over Extend | > 300 pcs (kelebihan tetap di hari itu) | Ungu |

**Badge status:**

| Badge | Kondisi |
|-------|---------|
| `sisa` | Normal belum penuh |
| `+ Lembur` | Normal penuh (200), extend masih ada |
| `FULL` | Normal + Extend penuh (300) |
| `OVER` | Melebihi 300 pcs — kelebihan tidak dialihkan ke hari lain |

#### 2. Visualisasi Kapasitas (kalender bulanan)
- **Sumber data:** **semua order** termasuk yang sudah `DONE`
- **Fungsi:** menampilkan **total kapasitas terisi secara historis dan mendatang** menggunakan algoritma *overflow* (kelebihan dialihkan ke hari berikutnya)
- Berguna untuk melihat seberapa padat suatu hari secara keseluruhan

#### Kenapa angkanya bisa berbeda untuk hari yang sama?

```
Visualisasi (mis. 300) = Aktif/antrian (mis. 270) + order DONE di hari itu (30)
```

Leaderboard mengelompokkan berdasarkan **dpProduksi** tanpa overflow, sedangkan kalender bulanan menggunakan algoritma queue overflow dan menyertakan semua order termasuk yang sudah DONE.

#### Kode warna kapasitas

| Warna | Kondisi |
|-------|---------|
| Abu-abu | Kosong (0 pcs) |
| Hijau muda–tua | 1–149 pcs (normal) |
| Kuning-oranye | 150–199 pcs (mendekati penuh) |
| Merah | 200 pcs (normal penuh) |
| Oranye | 201–300 pcs (extend/lembur aktif) |
| Ungu | > 300 pcs (over extend) |

### Halaman Semua Order (`/orders`)

- Daftar seluruh order dengan filter pencarian, status, risk level, dan tab bulan
- Pagination 10 order per halaman
- Klik baris untuk lihat detail order beserta progress tahapan
- **Export PDF** (admin only) — tombol hijau di kanan atas, dua pilihan:
  - **Laporan Mingguan:** order yang `dpProduksi`-nya jatuh di minggu berjalan (Senin–Sabtu)
  - **Laporan Bulanan:** order yang deadline-nya (`tglSelesai` / `dlCust`) jatuh di bulan berjalan

**Format PDF ekspor (landscape A4):**

| Kolom | Keterangan |
|-------|------------|
| NO | Nomor urut |
| CUSTOMER | Nama customer |
| QTY | Jumlah pcs |
| PAKET | Jenis + grade paket |
| KETERANGAN | Catatan order |
| BAHAN | Jenis bahan |
| DP PRODUKSI | Tanggal mulai produksi |
| DL CUST & PRODUKSI | Deadline customer |
| NO WORK ORDER | Kode WO |
| PROOFING — PENGIRIMAN | Stage checklist: `✓` = selesai, `-` = belum |

---

### Status Order

| Status | Kondisi |
|--------|---------|
| `OPEN` | Belum ada stage yang dicentang |
| `IN_PROGRESS` | Minimal 1 stage sudah dicentang |
| `DONE` | PENGIRIMAN sudah dicentang — checklist jadi read-only |

### Risk Level

| Level | Kondisi |
|-------|---------|
| `NORMAL` | Sisa hari > 3 |
| `NEAR` | Sisa hari ≤ 3, progress sudah di QC / FINISHING |
| `HIGH` | Sisa hari ≤ 3, progress masih ≤ JAHIT |
| `OVERDUE` | Sudah lewat deadline, belum DONE |
| `SAFE` | Status DONE |

---

## Setup & Instalasi

### 1. Clone & Install
```bash
git clone <repo-url>
cd Web-Monitoring
npm install
```

### 2. Environment Variable
Buat file `.env.local` di root project:
```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

### 3. Deploy Google Apps Script
1. Buka [script.google.com](https://script.google.com) → buat project baru
2. Paste isi file `Code.gs`
3. Klik **Deploy** → **New Deployment** → pilih type **Web App**
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Copy URL deployment → paste ke `.env.local`

### 4. Jalankan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000)

> **Catatan:** Setelah deploy ulang Apps Script, selalu buat **New Deployment** (bukan edit yang lama). Update URL baru ke `.env.local` lalu restart server.

---

## Struktur Proyek

```
Web-Monitoring/
├── app/
│   ├── page.tsx                    # Login page
│   └── (protected)/
│       ├── layout.tsx              # Sidebar + navigasi utama
│       ├── dashboard/
│       │   └── page.tsx            # Dashboard admin
│       ├── orders/
│       │   ├── page.tsx            # Daftar order (semua role)
│       │   └── new/page.tsx        # Form input order (CS)
│       ├── kapasitas/
│       │   └── page.tsx            # Jadwal kapasitas harian
│       └── production/
│           └── page.tsx            # Work board produksi
├── lib/
│   ├── api.ts                      # Fungsi fetch ke Apps Script
│   ├── auth-context.tsx            # Auth state (React Context)
│   ├── cache.ts                    # Cache SessionStorage
│   ├── constants.ts                # Stage, label, style mapping
│   ├── types.ts                    # TypeScript types & interfaces
│   └── utils.ts                    # Format tanggal, kalkulasi progress
├── Code.gs                         # Google Apps Script (backend)
├── .env.local                      # URL deployment (tidak di-commit)
└── README.md
```

---

## Catatan Pengembangan

- **Cache**: Data order di-cache di `sessionStorage` selama ±5 menit. Tombol **Refresh** di setiap halaman memaksa fetch ulang dari Sheets.
- **Date format**: Semua tanggal disimpan di Sheets dalam format `DD/MM/YYYY`. Frontend mem-parse manual tanpa bergantung locale browser.
- **Sequential checklist**: Stage harus dicentang berurutan. Tidak bisa skip stage.
- **Read-only setelah DONE**: Setelah PENGIRIMAN dicentang, seluruh checklist menjadi read-only dan tidak bisa diubah.
