1) Konsep Umum Sistem

Sistem terdiri dari 3 modul utama:

Order Intake (CS)

CS input order: Customer, Qty, Paket (2 kolom), Keterangan, Bahan, DP Produksi, DL Cust.

Sistem otomatis menghitung TGL SELESAI berdasarkan jadwal produksi.

Production Tracking (Produksi)

Produksi tidak input order.

Produksi hanya update progress dengan checklist stage:
PROOFING → WAITINGLIST → PRINT → PRES → CUT FABRIC → JAHIT → QC JAHIT DAN STEAM → FINISHING → PENGIRIMAN.

Monitoring (Admin)

Admin melihat semua data.

Fokus pada progress produksi, kapasitas harian, backlog, serta warning order yang mendekati deadline.

2) Role & Hak Akses
2.1 Admin

Boleh:

Melihat semua order & progress

Melihat dashboard & warning

Melihat rekap kapasitas per hari (utilisasi 200 pcs)

Mengubah user/role (opsional)

Override/penyesuaian data (opsional: edit order, koreksi stage)

Tidak wajib:

Input order

Checklist stage

2.2 Customer Service (CS)

Boleh:

Input order baru

Edit order (sebelum masuk produksi / sebelum stage berjalan) (opsional aturan)

Melihat status order & TGL SELESAI

Tidak boleh:

Mengubah checklist produksi (stage)

Mengubah kapasitas harian

2.3 Produksi

Boleh:

Melihat daftar kerja (worklist) berdasarkan tanggal / prioritas

Update checklist stage produksi (PROOFING sampai PENGIRIMAN)

Melihat deadline & warning (read-only)

Tidak boleh:

Input order baru

Edit data order (customer/qty/paket)

3) Data yang Dikelola (Level Flow)
3.1 Data Order (diinput CS)

Order ID / No

Tanggal input (otomatis)

Customer

Qty

Paket 1 (jenis produk)

Paket 2 (grade: A/B/C/D/E/BASIC)

Keterangan

Bahan

DP Produksi

DL Cust (deadline dari customer)

3.2 Data Jadwal Produksi (otomatis sistem)

Kapasitas harian: 200 pcs/hari

Order dipecah jadi “jatah produksi per hari” (allocation) jika perlu

TGL SELESAI order diambil dari alokasi paling akhir + 14 hari

3.3 Data Progress Produksi (diinput Produksi)

Checklist stage (L–T)

Tgl kirim (opsional saat PENGIRIMAN)

4) Flow Utama End-to-End
Flow A — Login & Routing Berdasarkan Role

User buka website → halaman Login

User login (email/username + password)

Sistem cek role:

Admin → masuk Dashboard Admin

CS → masuk Halaman Input Order + List Order

Produksi → masuk Board/Checklist Produksi + Worklist

Flow B — CS Input Order sampai TGL SELESAI Otomatis
B1. CS membuat order

CS buka menu Input Order

CS mengisi:

Customer, Qty, Paket1, Paket2, Keterangan, Bahan, DP Produksi, DL Cust

CS klik Simpan

B2. Sistem menjalankan Auto Allocation (200 pcs/hari)

Sistem mengambil Qty dan menjalankan rule:

mencari tanggal produksi paling awal yang masih ada slot kosong

mengisi sampai 200 pcs per hari

jika kurang, tarik pesanan berikutnya untuk isi slot kosong

jika lebih, sisanya dilempar ke hari berikutnya

B3. Sistem menghitung TGL SELESAI (14 hari)

Sistem menentukan:

target selesai tiap alokasi = tanggal produksi + 14 hari

TGL SELESAI order = target selesai TERAKHIR

Sistem menyimpan hasil:

order tersimpan

alokasi tersimpan

kolom TGL SELESAI otomatis terisi

Output yang terlihat CS

CS melihat order muncul di list dengan:

status awal (mis: “OPEN”)

TGL SELESAI

ringkas progress (masih PROOFING / belum jalan)

Flow C — Produksi Update Checklist Tahapan
C1. Produksi melihat worklist

Produksi login → halaman Worklist / Board

Produksi melihat list order yang harus dikerjakan:

bisa difilter berdasarkan prioritas deadline, customer, paket, atau tanggal alokasi produksi

C2. Update stage (checklist)

Saat produksi mulai:

checklist PROOFING dicentang

Saat lanjut tahapan:

centang stage berikutnya berurutan

Jika sudah selesai produksi & kirim:

centang PENGIRIMAN

isi TGL KIRIM (opsional)

Aturan yang disarankan

Checklist harus berurutan (tidak loncat), kecuali Admin mengizinkan override.

Status order otomatis:

belum ada checklist → OPEN

ada checklist sebagian → IN_PROGRESS

PENGIRIMAN dicentang → DONE

Flow D — Warning Deadline (Near Deadline & Risk)
D1. Sistem menghitung “sisa hari”

Setiap hari (atau real-time), sistem menghitung:

days_left = TGL_SELESAI - tanggal hari ini

D2. Sistem menilai risiko berdasarkan stage

Trigger utama:

Jika days_left <= 3 → masuk kategori “Near Deadline”

Rule risk (sesuai contoh kamu):

HIGH RISK: days_left <= 3 dan progress masih ≤ JAHIT

MEDIUM/NEAR: days_left <= 3 dan progress di QC/FINISHING

OVERDUE: days_left < 0 dan belum PENGIRIMAN

SAFE: PENGIRIMAN sudah dicentang

D3. Output warning

Muncul badge/warna di list Admin & Produksi:

HIGH (merah/tegas)

NEAR (kuning)

OVERDUE (merah pekat)

Notifikasi internal (opsional) bisa muncul di dashboard “Warning Center”

5) Flow Admin (Monitoring & Kontrol)
Admin Dashboard Flow

Admin login → Dashboard

Admin melihat ringkasan:

total order aktif

backlog pcs

jumlah order Near Deadline / Overdue

progress per stage (berapa order/pcs di Proofing, Print, Jahit, dst)

utilisasi kapasitas harian (berapa terisi dari 200)

Admin Monitoring Detail

Admin klik list “Near Deadline / High Risk”

Admin masuk detail order:

data order (customer, qty, paket, dll)

TGL SELESAI

stage checklist saat ini

histori perubahan (opsional)

Admin Opsional: Koreksi

Jika ada kesalahan input:

Admin dapat mengedit order (opsional)

Admin dapat reset/override stage (opsional, dengan alasan)

6) Status & Tampilan yang Disarankan
Status Order (untuk semua role)

OPEN: baru masuk, belum ada progress checklist

IN_PROGRESS: sudah ada progress

DONE: PENGIRIMAN dicentang (dan TGL KIRIM terisi)

Label Deadline

NORMAL: days_left > 3

NEAR: days_left <= 3

OVERDUE: days_left < 0

Label Risk

HIGH: near deadline tapi stage masih jauh (≤ JAHIT)

NEAR: near deadline tapi sudah QC/FINISHING

SAFE: shipped

7) Aturan Operasional Penting

CS input → sistem auto hitung (CS tidak menentukan TGL SELESAI manual)

Produksi hanya checklist (tidak edit order)

Capacity 200 pcs/hari selalu dijaga oleh sistem

14 hari dihitung dari tanggal alokasi produksi terakhir (jadi tanggal selesai realistis saat kapasitas penuh)

Warning menyoroti yang “hampir telat dan progress tertinggal”



nanti inputan data nya langsung masuk di spreadsheet aja, ini link nya
https://docs.google.com/spreadsheets/d/1sqTt3CHGlx-PdwYE-IdubHoUkLQIXb1gU31QwKnnaN8/edit?gid=0#gid=0



login nya : 

username : admin
pw : admin



username : cs
pw : cs

username : produksi
pw : produksi