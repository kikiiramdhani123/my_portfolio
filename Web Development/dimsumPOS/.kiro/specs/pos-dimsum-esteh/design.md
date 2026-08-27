# Design — POS Dimsum & Es Teh

**Status:** Approved · **Versi:** 1.0 · Turunan dari `requirements.md`

---

## 1. Arsitektur

```
┌─────────────────────────────────────────────┐
│  Browser (HP / Tablet / Laptop) — PWA       │
│  React Client Components + Service Worker   │
└───────────────┬─────────────────────────────┘
                │ fetch JSON (cookie sesi HttpOnly)
┌───────────────▼─────────────────────────────┐
│  Next.js 15 App Router (satu proses)         │
│  ┌────────────────────────────────────────┐ │
│  │ middleware.ts — cek sesi, redirect      │ │
│  ├────────────────────────────────────────┤ │
│  │ Server Components — render awal         │ │
│  │ Route Handlers /api/** — mutasi         │ │
│  ├────────────────────────────────────────┤ │
│  │ lib/  auth · rbac · stok · hpp · money  │ │
│  └────────────────────────────────────────┘ │
└───────────────┬─────────────────────────────┘
                │ pg Pool (transaksi eksplisit)
┌───────────────▼─────────────────────────────┐
│  PostgreSQL 18 — database `dimsumPos`       │
└─────────────────────────────────────────────┘
```

**Alasan satu proses:** pemilik hanya perlu menjalankan satu perintah di satu laptop; HP karyawan
membuka `http://<ip-laptop>:3000`. Tidak ada CORS, tidak ada dua server yang harus hidup bersamaan.

**Lapisan keamanan (defense in depth):**
1. `middleware.ts` — menolak permintaan tanpa cookie sesi.
2. Layout `(admin)` — `requireRole('OWNER')` di server component.
3. Setiap Route Handler — `requirePermission(kode, aksi)`.
4. Serializer respons — memangkas field harga beli / HPP / laba untuk pengguna tanpa `LAPORAN_LABA`.

---

## 2. Skema Database

Mengikuti ERD terlampir, dengan penambahan yang dibutuhkan requirement (ditandai ⊕).

### 2.1 Identitas & Akses
```
peran(id_peran PK, nama_peran UNIQUE)
hak_akses(id_hak_akses PK, kode_hak_akses UNIQUE, nama_hak_akses)
peran_hak_akses(id_peran FK, id_hak_akses FK,
                boleh_lihat, boleh_tambah, boleh_ubah, boleh_hapus)   PK gabungan
pengguna(id_pengguna PK, nama_pengguna, username UNIQUE, kata_sandi_hash,
         status_aktif, created_at, updated_at)
pengguna_peran(id_pengguna FK, id_peran FK)   PK gabungan
⊕ percobaan_login(id, username, waktu, berhasil, ip)      -- Req 1.8
```

### 2.2 Master Barang
```
satuan(id_satuan PK, kode_satuan UNIQUE, nama_satuan)
barang(id_barang PK, kode_barang UNIQUE, nama_barang, jenis_barang,
       id_satuan_dasar FK→satuan, dapat_dijual, dapat_dibeli, status_aktif,
       ⊕ stok_minimum NUMERIC(18,6) DEFAULT 0,
       ⊕ warna_kartu VARCHAR(20), ⊕ emoji VARCHAR(8),    -- tampilan kartu kasir
       created_at, updated_at)
satuan_barang(id_satuan_barang PK, id_barang FK, id_satuan FK,
              konversi_ke_satuan_dasar NUMERIC(18,6) CHECK > 0,
              harga_jual NUMERIC(18,2), barcode UNIQUE NULL, adalah_satuan_default)
```

### 2.3 Pembelian
```
pemasok(id_pemasok PK, kode_pemasok UNIQUE, nama_pemasok, nomor_telepon, alamat, status_aktif)
pembelian(id_pembelian PK, nomor_faktur_pembelian UNIQUE, tanggal_pembelian,
          id_pemasok FK, subtotal, diskon, pajak, total_pembelian,
          status_pembelian, id_pengguna FK)
detail_pembelian(id_detail_pembelian PK, id_pembelian FK ON DELETE CASCADE,
                 id_barang FK, id_satuan FK, jumlah, harga_beli_satuan,
                 konversi_ke_satuan_dasar, jumlah_satuan_dasar, subtotal)
```

### 2.4 Resep
```
resep(id_resep PK, id_barang_hasil FK, nama_resep, versi_resep,
      tanggal_berlaku, status_aktif)
      ⊕ UNIQUE INDEX (id_barang_hasil) WHERE status_aktif    -- Req 5.2
detail_resep(id_detail_resep PK, id_resep FK ON DELETE CASCADE,
             id_barang_bahan FK, id_satuan FK, jumlah, catatan)
      ⊕ larangan siklus ditegakkan di lib/resep.ts (Req 5.4)
```

### 2.5 Penjualan
```
penjualan(id_penjualan PK, nomor_transaksi UNIQUE, tanggal_penjualan, id_pengguna FK,
          subtotal, diskon, pajak, total_penjualan, jumlah_bayar, jumlah_kembalian,
          metode_pembayaran, status_penjualan,
          ⊕ idempotency_key UNIQUE NULL,        -- Req 6.14
          ⊕ catatan TEXT)
detail_penjualan(id_detail_penjualan PK, id_penjualan FK ON DELETE CASCADE,
                 id_barang FK, id_satuan FK, jumlah, harga_jual_satuan,
                 konversi_ke_satuan_dasar, jumlah_satuan_dasar,
                 hpp_satuan, total_hpp, subtotal_penjualan, laba_kotor,
                 ⊕ diskon_baris NUMERIC(18,2) DEFAULT 0)
```

### 2.6 Stok, Biaya, Pengaturan
```
pergerakan_stok(id_pergerakan_stok PK, id_barang FK, tanggal_pergerakan,
                jenis_pergerakan, referensi_id, jumlah, id_satuan FK,
                jumlah_satuan_dasar, harga_perolehan, nilai_persediaan,
                arah_stok SMALLINT CHECK (arah_stok IN (-1,1)), id_pengguna FK,
                ⊕ catatan TEXT)
   ⊕ append-only — ditegakkan trigger `cegah_ubah_pergerakan` (Req 7.3)
biaya_operasional(id_biaya PK, tanggal_biaya, kategori_biaya, keterangan,
                  jumlah, id_pengguna FK)
⊕ pengaturan(kunci PK, nilai)   -- nama_toko, alamat, pajak_persen, izinkan_stok_minus
```

### 2.7 Indeks Kinerja (Req 9.5)
```
idx_penjualan_tanggal        ON penjualan(tanggal_penjualan)
idx_penjualan_status_tanggal ON penjualan(status_penjualan, tanggal_penjualan)
idx_detail_penjualan_barang  ON detail_penjualan(id_barang)
idx_pergerakan_barang_waktu  ON pergerakan_stok(id_barang, tanggal_pergerakan, id_pergerakan_stok)
idx_detail_pembelian_barang  ON detail_pembelian(id_barang)
idx_biaya_tanggal            ON biaya_operasional(tanggal_biaya)
```

---

## 3. Algoritma Inti

### 3.1 HPP Weighted Average (rata-rata bergerak)

State disimpan pada baris `pergerakan_stok` **terakhir** per barang
(`nilai_persediaan` + saldo qty agregat).

Barang **masuk**:
```
qty_lama    = saldoSatuanDasar(barang)
nilai_lama  = nilaiPersediaanTerakhir(barang)
qty_masuk   = jumlah_satuan_dasar
nilai_masuk = harga_beli_satuan × jumlah      (harga per satuan input × qty input)

qty_baru    = qty_lama + qty_masuk
nilai_baru  = nilai_lama + nilai_masuk
hpp_baru    = qty_baru > 0 ? nilai_baru / qty_baru : hpp_lama
```

Barang **keluar**:
```
hpp        = hpp_lama                     (pengeluaran tidak mengubah rata-rata)
nilai_baru = nilai_lama − (hpp × qty_keluar)
```

`harga_perolehan` pada baris pergerakan selalu diisi HPP **setelah** operasi — nilai inilah yang
di-snapshot ke `detail_penjualan.hpp_satuan`.

Pembulatan: uang dibulatkan 2 desimal **hanya saat menulis kolom uang**; perhitungan antara memakai
presisi penuh `NUMERIC`, sehingga total laba laporan = Σ laba baris tanpa selisih.

### 3.2 Penyelesaian Penjualan (satu transaksi DB)
```
BEGIN
  1. cek idempotency_key → bila sudah ada, kembalikan penjualan lama (Req 6.14)
  2. SELECT … FOR UPDATE barang terkait, urut id_barang menaik (cegah deadlock)
  3. untuk setiap baris keranjang:
       a. ambil satuan_barang → harga_jual_satuan, konversi_ke_satuan_dasar
       b. jumlah_satuan_dasar = jumlah × konversi
       c. resolusi bahan:
            ada resep aktif  → bahan = detail_resep, qty = jml_bahan_dasar × jumlah_satuan_dasar
            tanpa resep      → bahan = [barang itu sendiri, qty = jumlah_satuan_dasar]
       d. hpp_satuan = Σ(hpp_bahan × qty_bahan) ÷ jumlah
       e. subtotal_penjualan = jumlah × harga_jual_satuan − diskon_baris
       f. laba_kotor = subtotal_penjualan − total_hpp
  4. nomor_transaksi = INV-YYYYMMDD-NNNN (advisory lock, lihat 3.4)
  5. INSERT penjualan; INSERT detail_penjualan (batch)
  6. tiap bahan: catatPergerakan(arah −1, PENJUALAN / PEMAKAIAN_RESEP, ref id_penjualan)
COMMIT
```
Gagal di langkah mana pun → `ROLLBACK`: stok tidak berubah, nomor tidak terpakai.

### 3.3 Deteksi Siklus Resep (Req 5.4)
DFS dari `id_barang_hasil` menelusuri `detail_resep → resep aktif bahan`. Bila simpul asal ditemui
kembali → tolak. Kedalaman dibatasi 10 sebagai penjaga tambahan.

### 3.4 Penomoran Transaksi
`INV-20260827-0001`. Diambil `SELECT COALESCE(MAX(seq),0)+1` di dalam transaksi yang sama dengan
`INSERT`, dilindungi `pg_advisory_xact_lock(hashtext('nomor_transaksi'))` agar dua kasir bersamaan
tidak mendapat nomor kembar.

---

## 4. Model Hak Akses

| Kode | Nama | OWNER | KASIR |
|---|---|:--:|:--:|
| `DASBOR` | Dasbor pemilik | LTUH | – |
| `MASTER_BARANG` | Barang & satuan | LTUH | – |
| `MASTER_PEMASOK` | Pemasok | LTUH | – |
| `PEMBELIAN` | Pembelian / barang masuk | LTUH | – |
| `RESEP` | Resep / BOM | LTUH | – |
| `STOK` | Kartu stok & opname | LTUH | – |
| `BIAYA` | Biaya operasional | LTUH | – |
| `LAPORAN_LABA` | Laporan laba & HPP | LTUH | – |
| `PENJUALAN` | Transaksi kasir | LTUH | L T |
| `PENJUALAN_BATAL` | Batalkan transaksi | LTUH | – |
| `PENGGUNA` | Kelola pengguna & peran | LTUH | – |

`L`=lihat `T`=tambah `U`=ubah `H`=hapus.
`requirePermission('PEMBELIAN','tambah')` → 403 `{ error: 'AKSES_DITOLAK' }` bila tidak terpenuhi.

---

## 5. Kontrak API

Sukses `{ data: T }` · gagal `{ error: string, detail?: unknown }`.

| Method | Endpoint | Izin |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | publik / sesi |
| GET | `/api/katalog` — produk layar kasir (tanpa HPP) | `PENJUALAN:lihat` |
| POST | `/api/penjualan` — selesaikan transaksi | `PENJUALAN:tambah` |
| GET | `/api/penjualan` — riwayat (KASIR: miliknya, hari ini) | `PENJUALAN:lihat` |
| POST | `/api/penjualan/[id]/batal` | `PENJUALAN_BATAL:ubah` |
| CRUD | `/api/barang`, `/api/barang/[id]`, `/api/barang/[id]/satuan` | `MASTER_BARANG:*` |
| CRUD | `/api/satuan` · `/api/pemasok` | `MASTER_BARANG` / `MASTER_PEMASOK` |
| CRUD | `/api/pembelian` (+ `/[id]/batal`) | `PEMBELIAN:*` |
| CRUD | `/api/resep` | `RESEP:*` |
| GET/POST | `/api/stok` · `/api/stok/[idBarang]` · `/api/stok/opname` | `STOK:*` |
| CRUD | `/api/biaya` | `BIAYA:*` |
| GET | `/api/laporan/{ringkasan,penjualan,labarugi,terlaris,pembelian,biaya}` | `LAPORAN_LABA:lihat` |
| CRUD | `/api/pengguna` · `/api/peran` | `PENGGUNA:*` |
| GET/PUT | `/api/pengaturan` | `DASBOR` |

---

## 6. Rancangan Antarmuka

### 6.1 Layar Kasir (`/kasir`) — prioritas kecepatan
```
┌──────────────────────────────────────────────────────────┐
│ ☰ POS Dimsum      [Cari / scan…]        🟢Online  Budi ▾ │
├────────────────────────────────┬─────────────────────────┤
│ [Semua][Dimsum][Minuman]       │  KERANJANG          🗑   │
│                                │  ─────────────────────  │
│ ┌──────┐┌──────┐┌──────┐       │  Dimsum Mentai          │
│ │ 🥟   ││ 🔥   ││ 🥟   │       │  2 × 15.000    30.000   │
│ │Mentai││Bakar ││Origi.│       │  [−] 2 [+]        ✕     │
│ │15.000││14.000││12.000│       │  ─────────────────────  │
│ └──────┘└──────┘└──────┘       │  Es Teh                 │
│ ┌──────┐┌──────┐┌──────┐       │  1 ×  5.000     5.000   │
│ │ 🥟   ││ 🎂   ││ 🧋   │       │                         │
│ │ Mini ││B'day ││EsTeh │       │  Subtotal      35.000   │
│ └──────┘└──────┘└──────┘       │  Diskon             0   │
│                                │  TOTAL         35.000   │
│                                │  ┌───────────────────┐  │
│                                │  │   BAYAR  (F2)     │  │
│                                │  └───────────────────┘  │
└────────────────────────────────┴─────────────────────────┘
```
Pada HP (< 768 px) keranjang menjadi *bottom sheet* yang dapat ditarik, dengan bilah total menempel
di bawah. Target sentuh ≥ 44 px. Tidak ada kolom harga beli / HPP di mana pun.

**Pintasan papan tik (laptop):** `F2` bayar · `F3` fokus pencarian · `Esc` tutup dialog · `Del` hapus baris.

### 6.2 Dialog Pembayaran
Tombol nominal cepat (`Uang Pas`, `20.000`, `50.000`, `100.000`), papan angka besar, kembalian
tampil seketika, `Enter` untuk konfirmasi.

### 6.3 Back Office (`/admin`)
Sidebar: Dasbor · Barang · Satuan · Pemasok · Pembelian · Resep · Stok · Biaya · Laporan · Pengguna · Pengaturan.
Dasbor: 4 kartu KPI (Omzet, Transaksi, Laba Kotor, Laba Bersih), grafik penjualan 7 hari,
tabel stok menipis, daftar transaksi terakhir.

### 6.4 Tema
Netral gelap/terang mengikuti sistem. Aksen `oklch` hangat (amber/merah bata) sesuai citra kuliner.
Kontras teks ≥ 4.5:1.

---

## 7. Penanganan Kesalahan

| Situasi | Perilaku |
|---|---|
| Koneksi DB putus saat transaksi | `ROLLBACK`, respons 503, keranjang klien **tidak** dikosongkan |
| Klien mengirim ulang penjualan | `idempotency_key` mengembalikan hasil pertama, tanpa duplikat |
| Stok bahan minus | Transaksi tetap jalan (Req 6.10), pergerakan tercatat, dasbor menandai merah |
| Pelanggaran unik (kode/faktur/barcode) | 409 dengan nama field yang bentrok |
| Validasi zod gagal | 422 dengan peta `field → pesan` berbahasa Indonesia |
| Sesi kedaluwarsa saat menyimpan | 401; klien menyimpan keranjang di `localStorage`, minta login ulang |

---

## 8. Strategi Pengujian

1. **Unit (`lib/`)** — `money`, weighted average, konversi satuan, deteksi siklus resep, penomoran transaksi.
2. **Integrasi (DB nyata, di-rollback)** — pembelian → stok naik & HPP benar; penjualan beresep →
   semua bahan berkurang; pembatalan → stok pulih; idempotensi.
3. **Otorisasi** — untuk setiap endpoint back office, sesi KASIR harus menerima 403.
4. **Asap/manual** — skenario di `tasks.md` tugas 20.

Kriteria lulus: unit & integrasi hijau, `npm run typecheck` bersih, dan tidak satu pun endpoint back
office dapat diakses sesi KASIR.
