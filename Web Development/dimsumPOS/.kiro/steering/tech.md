# Technical Steering — POS Dimsum & Es Teh

## Stack
| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Satu proses untuk UI + API. Server Actions/Route Handlers menjaga logika harga di server. Mudah dijalankan `npm run dev` di laptop dan diakses HP lewat LAN. |
| UI | **Tailwind CSS v4** + komponen lokal ala shadcn | Tanpa dependensi berat, tema gelap/terang, layar sentuh friendly. |
| Database | **PostgreSQL 18** (`dimsumPos`) | Sudah tersedia di laptop. `NUMERIC` untuk uang — tidak ada floating point error. |
| Driver DB | **`pg` (node-postgres)** + SQL murni | ERD sudah final; SQL murni memetakan 1:1 ke ERD tanpa lapisan ORM yang menyembunyikan transaksi. |
| Auth | Cookie sesi `HttpOnly` bertanda tangan (**`jose`** JWT HS256) + **`bcryptjs`** | Tidak butuh service eksternal. |
| PWA | `manifest.webmanifest` + service worker buatan sendiri | Installable, shell offline. |
| Validasi | **`zod`** di setiap boundary API | Input tidak pernah dipercaya. |

## Aturan Wajib (Non-negotiable)
1. **Uang & kuantitas**: kolom `NUMERIC(18,2)` (uang) / `NUMERIC(18,6)` (kuantitas). Di TypeScript
   diangkut sebagai `string` dari `pg` lalu diproses lewat helper `money.ts`. **Dilarang `float`.**
2. **Transaksi**: setiap operasi yang menyentuh > 1 tabel dibungkus `BEGIN … COMMIT` lewat
   helper `withTransaction()`. Penjualan dan pembelian wajib atomik.
3. **Otorisasi di server**: setiap Route Handler / Server Action memanggil `requirePermission(kode, aksi)`.
   Menyembunyikan menu di UI **bukan** pengamanan.
4. **Kartu stok**: mutasi stok hanya boleh lewat `lib/stok.ts` (`catatPergerakan()`), tidak pernah
   `UPDATE` langsung ke saldo.
5. **HPP: Weighted Average (rata-rata bergerak)**, di-snapshot ke `detail_penjualan.hpp_satuan`
   saat transaksi terjadi sehingga laporan historis tidak berubah ketika harga beli berubah.
6. **Satuan dasar**: semua kuantitas disimpan ganda — `jumlah` + `id_satuan` (satuan input) dan
   `jumlah_satuan_dasar` (hasil konversi). Perhitungan stok/HPP **selalu** memakai satuan dasar.
7. **Tanpa `any`** di kode TypeScript; `strict: true`.

## Konvensi
- Nama tabel/kolom DB: `snake_case` bahasa Indonesia (sesuai ERD).
- Nama file & fungsi TS: `camelCase`, komponen React `PascalCase`.
- Route API: `/api/<domain>/<resource>`, gaya REST.
- Migrasi: `db/migrations/NNN_nama.sql` — hanya append, tidak pernah diedit setelah dijalankan.

## Perintah
```bash
npm run dev         # jalankan dev server (0.0.0.0:3000, bisa diakses dari HP)
npm run db:migrate  # jalankan migrasi SQL yang belum diterapkan
npm run db:seed     # isi data awal (peran, hak akses, owner, katalog, satuan)
npm run db:reset    # drop semua tabel lalu migrate + seed
npm run build       # build produksi
npm run typecheck   # tsc --noEmit
```
