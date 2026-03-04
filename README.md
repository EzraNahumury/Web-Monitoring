# Produksi Manager — AYRES System

Sistem manajemen produksi berbasis web yang terintegrasi dengan Google Sheets. Memungkinkan CS input order, tim produksi update progress, dan admin memonitor keseluruhan operasi secara real-time.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Google Apps Script (via Web App deployment)
- **Database**: Google Sheets
- **Auth**: Session-based (localStorage)

---

## Spreadsheet

```
https://docs.google.com/spreadsheets/d/1OLGa2zlbGp9cfKl5TP6kX_UeWg9GWRBpHGVEI7WOVUU/edit
```

### Struktur Kolom (Sheet1, data mulai baris 5)

| Kolom | Header | Keterangan |
|-------|--------|------------|
| A (1) | NO | Nomor urut order |
| B (2) | CUSTOMER | Nama customer |
| C (3) | QTY | Jumlah pcs |
| D (4) | PAKET 1 | Jenis produk (PRO, KLASIK, dll) |
| E (5) | PAKET 2 | Grade (A/B/C/D/E/BASIC) |
| F (6) | KETERANGAN | Catatan order |
| G (7) | BAHAN | Jenis bahan |
| H (8) | DP PRODUKSI | Tanggal mulai produksi |
| I (9) | DL CUST | Deadline dari customer |
| J (10) | TGL SELESAI | Estimasi selesai (auto) |
| K (11) | NO WORK ORDER | Kode WO (auto, format WO2603-001) |
| L (12) | PROOFING | Checkbox stage |
| M (13) | WAITINGLIST | Checkbox stage |
| N (14) | PRINT | Checkbox stage |
| O (15) | PRES | Checkbox stage |
| P (16) | CUT FABRIC | Checkbox stage |
| Q (17) | JAHIT | Checkbox stage |
| R (18) | JAHIT DAN STEAM | Checkbox stage |
| S (19) | FINISHING | Checkbox stage |
| T (20) | PENGIRIMAN | Checkbox stage |
| U (21) | STATUS | OPEN / IN_PROGRESS / DONE |
| V (22) | TGL KIRIM | Tanggal kirim aktual |

---

## Role & Akses

| Fitur | Admin | CS | Produksi |
|-------|:-----:|:--:|:--------:|
| Dashboard | ✅ | ❌ | ❌ |
| Lihat semua order | ✅ | ✅ | ✅ |
| Input order baru | ❌ | ✅ | ❌ |
| Edit order | ❌ | ✅ | ❌ |
| Update progress/stage | ❌ | ❌ | ✅ |
| Kapasitas produksi | ✅ | ✅ | ❌ |
| Work board | ❌ | ❌ | ✅ |

---

## Akun Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | Admin |
| `cs` | `cs` | Customer Service |
| `produksi` | `produksi` | Produksi |

---

## Logika Bisnis

### Auto Scheduling (TGL SELESAI)
- Kapasitas produksi: **200 pcs/hari**
- Sistem mengalokasikan qty order ke hari-hari produksi berdasarkan slot yang tersedia
- TGL SELESAI = tanggal alokasi terakhir + **14 hari**

### Status Order
| Status | Kondisi |
|--------|---------|
| `OPEN` | Belum ada progress checklist |
| `IN_PROGRESS` | Ada minimal 1 stage dicentang |
| `DONE` | PENGIRIMAN dicentang |

### Risk Level
| Level | Kondisi |
|-------|---------|
| `NORMAL` | Sisa hari > 3 |
| `NEAR` | Sisa hari ≤ 3, progress sudah di QC/FINISHING |
| `HIGH` | Sisa hari ≤ 3, progress masih ≤ JAHIT |
| `OVERDUE` | Sudah lewat deadline, belum DONE |
| `SAFE` | Status DONE |

### No Work Order
Format: `WO[YY][MM]-[NNN]`
Contoh: `WO2603-001` = order ke-1, bulan Maret 2026

---

## Setup & Instalasi

### 1. Clone & Install
```bash
git clone <repo-url>
cd Web-Monitoring
npm install
```

### 2. Environment Variable
Buat file `.env.local`:
```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

### 3. Google Apps Script
- Buka [script.google.com](https://script.google.com)
- Buat project baru, paste isi `Code.gs`
- Deploy → **New Deployment** → Web App
  - Execute as: **Me**
  - Who has access: **Anyone**
- Copy URL deployment → paste ke `.env.local`

### 4. Jalankan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000)

---

## Struktur Proyek

```
app/
├── page.tsx                    # Login page
├── (protected)/
│   ├── layout.tsx              # Sidebar + navigasi
│   ├── dashboard/page.tsx      # Dashboard admin
│   ├── orders/
│   │   ├── page.tsx            # Daftar order
│   │   └── new/page.tsx        # Form input order
│   ├── kapasitas/page.tsx      # Kapasitas harian
│   └── production/page.tsx     # Work board produksi
lib/
├── api.ts                      # API calls ke proxy
├── auth-context.tsx            # Auth state
├── cache.ts                    # SessionStorage cache
├── constants.ts                # Stage, label, style
├── types.ts                    # TypeScript types
└── utils.ts                    # Format tanggal, kalkulasi
Code.gs                         # Google Apps Script
```
