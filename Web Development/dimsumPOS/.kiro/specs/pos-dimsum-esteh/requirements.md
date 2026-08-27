# Requirements — POS Dimsum & Es Teh

**Status:** Approved
**Versi:** 1.0
**Format:** User Story + Acceptance Criteria EARS (Easy Approach to Requirements Syntax)

Pola EARS yang dipakai:
- `WHEN <pemicu> THEN <sistem> SHALL <respons>` — event-driven
- `IF <kondisi> THEN <sistem> SHALL <respons>` — unwanted behaviour / penjagaan
- `WHILE <keadaan> <sistem> SHALL <respons>` — state-driven
- `THE <sistem> SHALL <respons>` — ubiquitous

---

## Requirement 1 — Autentikasi Pengguna

**User Story:** Sebagai pemilik toko, saya ingin setiap orang masuk dengan akunnya sendiri,
agar setiap transaksi bisa dilacak siapa pembuatnya.

### Acceptance Criteria
1.1. WHEN pengguna membuka URL apa pun selain `/login` tanpa sesi valid THEN sistem SHALL mengalihkan ke `/login`.
1.2. WHEN pengguna mengirim `username` dan `kata_sandi` yang cocok dan `status_aktif = true` THEN sistem SHALL membuat sesi dan mengalihkan ke halaman beranda sesuai perannya (OWNER → `/admin`, KASIR → `/kasir`).
1.3. IF kombinasi `username`/`kata_sandi` salah THEN sistem SHALL menampilkan pesan generik "Username atau kata sandi salah" tanpa mengungkap mana yang salah.
1.4. IF akun ada tetapi `status_aktif = false` THEN sistem SHALL menolak login dengan pesan "Akun dinonaktifkan. Hubungi pemilik."
1.5. THE sistem SHALL menyimpan kata sandi hanya sebagai hash bcrypt (cost ≥ 10) di `pengguna.kata_sandi_hash`.
1.6. THE sistem SHALL menyimpan sesi dalam cookie `HttpOnly`, `SameSite=Lax`, masa berlaku 12 jam.
1.7. WHEN pengguna menekan "Keluar" THEN sistem SHALL menghapus cookie sesi dan mengalihkan ke `/login`.
1.8. IF terjadi 10 percobaan login gagal untuk `username` yang sama dalam 10 menit THEN sistem SHALL menolak percobaan berikutnya selama 5 menit.

---

## Requirement 2 — Peran & Hak Akses (RBAC)

**User Story:** Sebagai pemilik, saya ingin karyawan hanya bisa membuka halaman penjualan,
agar data harga beli, HPP, dan laba tidak bocor.

### Acceptance Criteria
2.1. THE sistem SHALL menyediakan minimal dua peran bawaan: `OWNER` dan `KASIR`.
2.2. THE sistem SHALL menyimpan izin sebagai `peran_hak_akses(id_peran, id_hak_akses, boleh_lihat, boleh_tambah, boleh_ubah, boleh_hapus)`.
2.3. WHEN pengguna berperan `KASIR` mengakses rute apa pun di bawah `/admin` THEN sistem SHALL merespons 403 dan menampilkan halaman "Akses ditolak".
2.4. WHEN permintaan API diterima THEN sistem SHALL memvalidasi izin di server sebelum menjalankan aksi, terlepas dari apa yang ditampilkan UI.
2.5. THE sistem SHALL menghilangkan field `harga_beli_satuan`, `hpp_satuan`, `total_hpp`, dan `laba_kotor` dari setiap respons API yang diminta pengguna tanpa hak akses `LAPORAN_LABA`.
2.6. WHEN pemilik mengubah izin sebuah peran THEN sistem SHALL memberlakukan izin baru pada permintaan berikutnya tanpa perlu redeploy.
2.7. IF pengguna terakhir yang berperan `OWNER` hendak dinonaktifkan atau dicabut peran OWNER-nya THEN sistem SHALL menolak dengan pesan "Minimal satu pemilik aktif harus ada".
2.8. THE sistem SHALL mengizinkan satu pengguna memiliki lebih dari satu peran (`pengguna_peran` N:N).

---

## Requirement 3 — Master Barang & Satuan

**User Story:** Sebagai pemilik, saya ingin mendaftarkan semua barang — yang dijual maupun bahan/kemasan —
beserta satuan dan konversinya, agar stok terhitung akurat meski dibeli per dus dan dipakai per pcs.

### Acceptance Criteria
3.1. THE sistem SHALL menyimpan barang dengan `kode_barang` unik, `nama_barang`, `jenis_barang`, `id_satuan_dasar`, `dapat_dijual`, `dapat_dibeli`, `status_aktif`.
3.2. THE sistem SHALL mendukung `jenis_barang` minimal: `MAKANAN`, `MINUMAN`, `BAHAN`, `KEMASAN`, `LAINNYA`.
3.3. WHEN pemilik membuat barang THEN sistem SHALL otomatis membuat satu baris `satuan_barang` untuk satuan dasar dengan `konversi_ke_satuan_dasar = 1` dan `adalah_satuan_default = true`.
3.4. THE sistem SHALL mengizinkan banyak `satuan_barang` per barang, masing-masing dengan `konversi_ke_satuan_dasar` (mis. 1 PAX = 50 PCS) dan `harga_jual` sendiri.
3.5. IF `konversi_ke_satuan_dasar` ≤ 0 THEN sistem SHALL menolak penyimpanan.
3.6. IF barang sudah pernah dipakai di transaksi mana pun THEN sistem SHALL menolak penghapusan dan menyarankan menonaktifkan (`status_aktif = false`).
3.7. WHEN barang berstatus `dapat_dijual = false` THEN sistem SHALL tidak menampilkannya di layar kasir.
3.8. THE sistem SHALL mengizinkan penambahan menu dimsum baru kapan saja tanpa perubahan kode.
3.9. IF `kode_barang` atau `barcode` sudah dipakai barang lain THEN sistem SHALL menolak dengan pesan duplikat.

---

## Requirement 4 — Pemasok & Pembelian (Barang Masuk)

**User Story:** Sebagai pemilik, saya ingin mencatat pembelian beserta harga belinya,
agar stok bertambah dan HPP terhitung otomatis.

### Acceptance Criteria
4.1. THE sistem SHALL menyimpan pembelian sebagai header `pembelian` + baris `detail_pembelian`.
4.2. WHEN pemilik menyimpan pembelian dengan `status_pembelian = 'SELESAI'` THEN sistem SHALL, dalam satu transaksi database: menyimpan header, menyimpan seluruh detail, menambah stok tiap barang, dan menulis satu baris `pergerakan_stok` per detail dengan `arah_stok = +1` dan `jenis_pergerakan = 'PEMBELIAN'`.
4.3. THE sistem SHALL menghitung `detail_pembelian.jumlah_satuan_dasar = jumlah × konversi_ke_satuan_dasar` di server.
4.4. THE sistem SHALL menghitung `subtotal = jumlah × harga_beli_satuan` dan `total_pembelian = subtotal_header − diskon + pajak` di server; nilai kiriman klien diabaikan.
4.5. WHEN stok bertambah THEN sistem SHALL memperbarui HPP rata-rata bergerak dengan rumus
   `hpp_baru = (nilai_persediaan_lama + nilai_masuk) ÷ (qty_lama + qty_masuk)`, dan menyimpan hasilnya pada `pergerakan_stok.harga_perolehan` serta `pergerakan_stok.nilai_persediaan`.
4.6. IF `jumlah` ≤ 0 atau `harga_beli_satuan` < 0 pada baris mana pun THEN sistem SHALL menolak seluruh pembelian.
4.7. WHEN pembelian berstatus `DRAFT` THEN sistem SHALL TIDAK mengubah stok.
4.8. IF pembelian yang sudah `SELESAI` dibatalkan THEN sistem SHALL membuat pergerakan stok pembalik (`arah_stok = -1`, `jenis_pergerakan = 'BATAL_PEMBELIAN'`) dan bukan menghapus riwayat.
4.9. THE sistem SHALL menolak `nomor_faktur_pembelian` duplikat.

---

## Requirement 5 — Resep / BOM (Bill of Material)

**User Story:** Sebagai pemilik, saya ingin menetapkan bahan dan kemasan yang terpakai untuk tiap produk,
agar satu penjualan es teh otomatis mengurangi teh, gula, gelas, dan sedotan.

### Acceptance Criteria
5.1. THE sistem SHALL menyimpan resep sebagai header `resep(id_barang_hasil, nama_resep, versi_resep, tanggal_berlaku, status_aktif)` + baris `detail_resep(id_barang_bahan, jumlah, id_satuan)`.
5.2. THE sistem SHALL mengizinkan hanya satu resep `status_aktif = true` per `id_barang_hasil` pada satu waktu.
5.3. WHEN pemilik mengaktifkan resep versi baru THEN sistem SHALL menonaktifkan versi sebelumnya secara otomatis.
5.4. IF sebuah resep memuat dirinya sendiri sebagai bahan, langsung maupun tidak langsung (siklus) THEN sistem SHALL menolak penyimpanan.
5.5. WHEN produk terjual THEN sistem SHALL mengurangi stok setiap bahan sebesar `jumlah_bahan_satuan_dasar × qty_terjual_satuan_dasar` dan mencatat `pergerakan_stok` dengan `jenis_pergerakan = 'PEMAKAIAN_RESEP'`.
5.6. IF barang yang dijual tidak memiliki resep aktif THEN sistem SHALL mengurangi stok barang itu sendiri (`jenis_pergerakan = 'PENJUALAN'`).
5.7. THE sistem SHALL menghitung HPP produk beresep sebagai jumlah dari (HPP rata-rata bahan × jumlah bahan) pada saat penjualan.

---

## Requirement 6 — Penjualan / Kasir

**User Story:** Sebagai karyawan, saya ingin melayani pembeli dengan cepat dari satu layar,
agar antrean tidak menumpuk.

### Acceptance Criteria
6.1. THE sistem SHALL menampilkan seluruh barang `dapat_dijual = true AND status_aktif = true` sebagai kartu bergambar yang dikelompokkan per `jenis_barang`.
6.2. WHEN karyawan menekan kartu produk THEN sistem SHALL menambahkan 1 unit ke keranjang, atau menaikkan qty bila produk sudah ada di keranjang.
6.3. THE sistem SHALL mengizinkan ubah qty, ubah satuan jual, diskon per baris, dan hapus baris di keranjang.
6.4. THE sistem SHALL menampilkan subtotal, diskon, pajak, dan total secara langsung setiap keranjang berubah.
6.5. WHEN karyawan menekan "Bayar" THEN sistem SHALL meminta `metode_pembayaran` (`TUNAI`, `QRIS`, `TRANSFER`) dan `jumlah_bayar`.
6.6. IF `metode_pembayaran = 'TUNAI'` dan `jumlah_bayar < total_penjualan` THEN sistem SHALL menolak penyelesaian transaksi.
6.7. WHEN transaksi diselesaikan THEN sistem SHALL, dalam satu transaksi database: membuat `penjualan` + `detail_penjualan`, meng-snapshot `harga_jual_satuan` dan `hpp_satuan`, mengurangi stok (lewat resep atau barang langsung), menulis `pergerakan_stok`, dan menghitung `laba_kotor` per baris.
6.8. THE sistem SHALL membuat `nomor_transaksi` unik berformat `INV-YYYYMMDD-NNNN` dengan `NNNN` reset harian.
6.9. WHEN transaksi selesai THEN sistem SHALL menampilkan `jumlah_kembalian` dan struk yang dapat dicetak/dibagikan.
6.10. IF stok satuan dasar suatu bahan tidak mencukupi THEN sistem SHALL tetap mengizinkan penjualan namun menandai transaksi dan memunculkan peringatan stok minus kepada pemilik (konfigurasi `izinkan_stok_minus`, default `true` agar antrean tidak terhenti).
6.11. THE sistem SHALL TIDAK PERNAH menampilkan HPP atau laba di layar kasir.
6.12. WHEN karyawan membuka "Riwayat" THEN sistem SHALL menampilkan hanya transaksi hari berjalan yang dibuatnya sendiri.
6.13. IF transaksi hendak dibatalkan (`status_penjualan = 'BATAL'`) THEN sistem SHALL mensyaratkan hak akses `PENJUALAN_BATAL` dan membuat pergerakan stok pembalik.
6.14. THE sistem SHALL mengabaikan pengiriman ulang dengan `idempotency_key` yang sama agar penjualan tidak terduplikasi saat koneksi buruk.

---

## Requirement 7 — Kartu Stok & Penyesuaian

**User Story:** Sebagai pemilik, saya ingin melihat riwayat keluar-masuk tiap barang,
agar selisih fisik bisa ditelusuri.

### Acceptance Criteria
7.1. THE sistem SHALL mencatat setiap perubahan stok pada `pergerakan_stok` dengan `jenis_pergerakan`, `referensi_id`, `arah_stok`, `jumlah_satuan_dasar`, `harga_perolehan`, `nilai_persediaan`, dan `id_pengguna`.
7.2. THE sistem SHALL menghitung stok berjalan sebagai jumlah `arah_stok × jumlah_satuan_dasar` seluruh pergerakan barang tersebut.
7.3. THE sistem SHALL TIDAK PERNAH mengizinkan `UPDATE` atau `DELETE` pada baris `pergerakan_stok` yang sudah tersimpan.
7.4. WHEN pemilik melakukan stok opname THEN sistem SHALL membuat pergerakan `PENYESUAIAN` sebesar selisih antara stok fisik dan stok sistem, dengan catatan wajib diisi.
7.5. THE sistem SHALL menandai barang yang stoknya ≤ `stok_minimum` sebagai "Stok Menipis" di dasbor pemilik.
7.6. WHEN pemilik membuka kartu stok satu barang THEN sistem SHALL menampilkan saldo berjalan per baris.

---

## Requirement 8 — Biaya Operasional

**User Story:** Sebagai pemilik, saya ingin mencatat listrik, sewa, dan gas,
agar laba bersih yang tampil adalah angka sesungguhnya.

### Acceptance Criteria
8.1. THE sistem SHALL menyimpan `biaya_operasional(tanggal_biaya, kategori_biaya, keterangan, jumlah, id_pengguna)`.
8.2. THE sistem SHALL menyediakan kategori bawaan: `LISTRIK`, `AIR`, `GAS`, `SEWA`, `GAJI`, `TRANSPORT`, `LAINNYA`.
8.3. THE sistem SHALL TIDAK menambahkan biaya operasional ke stok maupun HPP barang.
8.4. THE sistem SHALL menghitung `laba_bersih = laba_kotor − total_biaya_operasional` untuk periode yang sama.
8.5. IF `jumlah` ≤ 0 THEN sistem SHALL menolak penyimpanan.

---

## Requirement 9 — Laporan

**User Story:** Sebagai pemilik, saya ingin melihat penjualan, laba, dan produk terlaris per periode,
agar bisa memutuskan menu dan harga.

### Acceptance Criteria
9.1. WHEN pemilik membuka dasbor THEN sistem SHALL menampilkan omzet hari ini, jumlah transaksi, laba kotor, laba bersih, dan daftar stok menipis.
9.2. THE sistem SHALL menyediakan laporan dengan filter rentang tanggal: Penjualan, Laba Rugi, Produk Terlaris, Pembelian, Kartu Stok, Biaya Operasional.
9.3. THE sistem SHALL menghitung `laba_kotor = Σ(subtotal_penjualan) − Σ(total_hpp)` hanya dari penjualan `status_penjualan = 'SELESAI'`.
9.4. THE sistem SHALL mengekspor setiap laporan ke CSV.
9.5. THE sistem SHALL mengembalikan laporan rentang 1 bulan dalam < 2 detik pada data 50.000 baris detail penjualan.
9.6. IF pengguna tanpa hak akses `LAPORAN_LABA` meminta laporan laba THEN sistem SHALL merespons 403.

---

## Requirement 10 — PWA, Perangkat, dan Ketersediaan

**User Story:** Sebagai pemilik, saya ingin aplikasi bisa dipasang di HP karyawan lewat browser,
agar tidak perlu membeli mesin kasir.

### Acceptance Criteria
10.1. THE sistem SHALL menyediakan `manifest.webmanifest` sehingga browser menawarkan "Tambahkan ke Layar Utama".
10.2. THE sistem SHALL bekerja pada lebar layar 360 px hingga 1920 px tanpa scroll horizontal.
10.3. THE sistem SHALL menyediakan target sentuh ≥ 44×44 px pada layar kasir.
10.4. WHILE perangkat offline THE sistem SHALL tetap memuat shell aplikasi dari service worker dan menampilkan indikator "Offline".
10.5. THE sistem SHALL mendukung mode gelap dan terang mengikuti preferensi perangkat.
10.6. THE sistem SHALL dapat diakses dari HP di jaringan Wi‑Fi yang sama dengan laptop pengelola.

---

## Requirement 11 — Integritas Data & Audit

11.1. THE sistem SHALL memberi `created_at` dan `updated_at` pada tabel master.
11.2. THE sistem SHALL menolak penghapusan baris master yang masih dirujuk transaksi (`ON DELETE RESTRICT`).
11.3. THE sistem SHALL mencatat `id_pengguna` pada setiap transaksi penjualan, pembelian, biaya, dan pergerakan stok.
11.4. THE sistem SHALL menyimpan seluruh waktu sebagai `TIMESTAMPTZ` dan menampilkannya dalam zona `Asia/Jakarta`.

---

## Di Luar Cakupan (Versi 1.0)
- Multi-cabang / multi-outlet
- Integrasi payment gateway QRIS otomatis (QRIS dicatat manual)
- Pencetakan ke printer thermal Bluetooth langsung (memakai dialog cetak browser)
- Program loyalitas pelanggan
- Sinkronisasi penjualan offline (offline hanya untuk shell aplikasi)
