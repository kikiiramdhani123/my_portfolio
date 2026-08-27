# Implementation Plan — POS Dimsum & Es Teh

Setiap tugas menyebut requirement yang dipenuhinya. Tandai `[x]` saat selesai.

- [x] **1. Scaffold proyek & konfigurasi**
  - Inisialisasi Next.js 15 + TypeScript `strict` + Tailwind v4
  - Dependensi: `pg`, `bcryptjs`, `jose`, `zod`
  - `.env.example`, `.env.local` (`DATABASE_URL`, `SESSION_SECRET`, `TZ=Asia/Jakarta`)
  - Skrip npm: `dev` (`-H 0.0.0.0`), `build`, `start`, `typecheck`, `db:migrate`, `db:seed`, `db:reset`
  - _Req: 10.6_

- [x] **2. Lapisan database**
  - `src/lib/db.ts`: `pg.Pool`, `query()`, `withTransaction()`, parser `NUMERIC` → `string`
  - `scripts/migrate.ts`: tabel `_migrasi`, jalankan file `db/migrations/*.sql` berurutan sekali saja
  - _Req: 11.1, 11.4_

- [x] **3. Migrasi skema inti**
  - `001_skema_inti.sql`: seluruh tabel bagian Design §2 + constraint + indeks
  - `002_trigger.sql`: trigger append-only `pergerakan_stok`, trigger `updated_at`
  - Unique partial index resep aktif (`idx_resep_aktif_unik`) — ikut di `001_skema_inti.sql`
  - _Req: 3.1, 4.1, 5.1, 5.2, 6.7, 7.1, 7.3, 8.1, 11.2_

- [x] **4. Seed data awal**
  - Satuan: PCS, PAX, DUS, PACK, GRAM, KG, ML, LITER, LEMBAR
  - Hak akses & peran (OWNER, KASIR) + matriks izin Design §4
  - Pengguna `owner` / `owner123` dan `kasir` / `kasir123` (bcrypt)
  - Barang: 5 dimsum + Es Teh (dapat_dijual) · plastik, gelas, sedotan, mika, teh, gula, saus (bahan/kemasan)
  - Resep contoh: Es Teh (teh + gula + gelas + sedotan), Dimsum Mentai (dimsum + mika + plastik + saus)
  - Pengaturan: nama_toko, pajak_persen=0, izinkan_stok_minus=true
  - _Req: 2.1, 3.2, 3.8, 5.1_

- [x] **5. Utilitas uang & satuan**
  - `src/lib/money.ts`: `d()`, `tambah`, `kurang`, `kali`, `bagi`, `bulatkanUang`, `keUang`,
    `keKuantitas`, `formatRupiah` — desimal presisi tetap berbasis BigInt
  - `src/lib/satuan.ts`: konversi satuan input ↔ satuan dasar
  - Unit test aritmetika & pembulatan
  - _Req: 3.4, 4.3_

- [x] **6. Autentikasi**
  - `src/lib/auth.ts`: `hashSandi`, `verifikasiSandi`, `buatSesi` (JWT `jose`, 12 jam),
    `bacaSesi`, `hapusSesi`, `requireUser()`
  - Rate limit lewat `percobaan_login`
  - `POST /api/auth/login`, `POST /api/auth/logout`
  - Halaman `/login` (form, pesan galat generik)
  - `middleware.ts`: redirect tanpa sesi → `/login`
  - _Req: 1.1–1.8_

- [x] **7. RBAC**
  - `src/lib/rbac.ts`: `muatIzin(idPengguna)`, `punyaIzin()`, `requirePermission()`, `requireRole()`
  - Layout `(admin)` memaksa `OWNER`; halaman 403 "Akses ditolak"
  - Helper `sanitasiRahasia()` memangkas HPP/laba untuk non-`LAPORAN_LABA`
  - _Req: 2.2–2.8_

- [x] **8. Mesin stok**
  - `src/lib/stok.ts`: `posisiStok()` (saldo + nilai + HPP), `hppSaatIni()`,
    `catatPergerakan()` (weighted average masuk/keluar), `ringkasanStok()`, `kartuStok()`
  - Uji integrasi: masuk 2×harga beda → HPP rata-rata benar; keluar tidak mengubah HPP
  - _Req: 4.5, 7.1, 7.2, 7.6_

- [x] **9. Master satuan & barang**
  - Validator zod, CRUD `/api/satuan`, `/api/barang`, `/api/barang/[id]/satuan`
  - Auto-buat `satuan_barang` dasar (konversi 1, default)
  - Tolak hapus bila sudah dipakai transaksi → sarankan nonaktifkan
  - Halaman `/admin/barang` + `/admin/satuan` (tabel, cari, form modal)
  - _Req: 3.1–3.9, 11.2_

- [x] **10. Pemasok**
  - CRUD `/api/pemasok` + halaman `/admin/pemasok`
  - _Req: 4.1_

- [x] **11. Pembelian (barang masuk)**
  - `src/lib/pembelian.ts`: `simpanPembelian()` transaksional, hitung subtotal/total di server,
    `catatPergerakan(+1)`, `batalkanPembelian()` membuat pergerakan pembalik
  - `/api/pembelian`, `/api/pembelian/[id]`, `/api/pembelian/[id]/batal`
  - Halaman `/admin/pembelian` (daftar) + form multi-baris
  - _Req: 4.1–4.9_

- [x] **12. Resep / BOM**
  - `src/lib/resep.ts`: `simpanResep()` + `deteksiSiklus()`, aktivasi versi (nonaktifkan versi lama),
    `bahanResepAktif()`
  - `/api/resep` CRUD + halaman `/admin/resep`
  - _Req: 5.1–5.7_

- [x] **13. Katalog kasir**
  - `GET /api/katalog`: barang `dapat_dijual` + satuan jual + harga, dikelompokkan per jenis, tanpa HPP
  - _Req: 3.7, 6.1, 6.11_

- [x] **14. Mesin penjualan**
  - `src/lib/penjualan.ts`: `buatNomorTransaksi()` (advisory lock), `selesaikanPenjualan()`
    transaksional sesuai Design §3.2, `batalkanPenjualan()`
  - Idempotensi lewat `idempotency_key`
  - `/api/penjualan` (POST/GET), `/api/penjualan/[id]/batal`
  - _Req: 6.5–6.14_

- [x] **15. Antarmuka kasir**
  - `/kasir`: grid produk + pencarian + tab kategori; keranjang (qty, satuan, diskon baris, hapus)
  - Dialog pembayaran (nominal cepat, papan angka, kembalian real-time)
  - Struk cetak (`window.print`, CSS 58 mm)
  - Pintasan papan tik; bottom-sheet responsif; keranjang persist `localStorage`
  - `/kasir/riwayat`: transaksi hari ini milik pengguna
  - _Req: 6.1–6.4, 6.9, 6.12, 10.2, 10.3_

- [x] **16. Kartu stok & opname**
  - `/api/stok` (ringkasan saldo semua barang), `/api/stok/[idBarang]` (kartu berjalan),
    `/api/stok/opname` (penyesuaian, catatan wajib)
  - Halaman `/admin/stok` + `/admin/stok/[id]`
  - Penanda "Stok Menipis" (`saldo ≤ stok_minimum`)
  - _Req: 7.4–7.6_

- [x] **17. Biaya operasional**
  - CRUD `/api/biaya` + halaman `/admin/biaya` (filter bulan, total per kategori)
  - _Req: 8.1–8.5_

- [x] **18. Laporan & dasbor**
  - `src/lib/laporan.ts`: ringkasan, penjualan, laba rugi, produk terlaris, pembelian, biaya
  - `/api/laporan/*` + ekspor CSV
  - `/admin` dasbor (KPI, grafik 7 hari, stok menipis) · `/admin/laporan`
  - _Req: 9.1–9.6_

- [x] **19. Pengguna, peran, pengaturan**
  - CRUD `/api/pengguna`, `/api/peran` (matriks izin dapat diubah), penjagaan "minimal satu OWNER aktif"
  - `/api/pengaturan` + halaman `/admin/pengguna`, `/admin/pengaturan`
  - _Req: 2.6, 2.7, 1.4_

- [x] **20. PWA & finalisasi**
  - `manifest.webmanifest`, ikon 192/512, `sw.js` (cache shell), indikator online/offline
  - Mode gelap/terang, uji lebar 360–1920 px
  - `README.md`: cara menjalankan, akun bawaan, akses dari HP lewat IP LAN
  - Uji asap: login OWNER → tambah barang → pembelian → cek stok/HPP → login KASIR →
    jual → cek stok berkurang → cek laba di OWNER → pastikan KASIR ditolak di `/admin`
  - _Req: 10.1–10.6_
