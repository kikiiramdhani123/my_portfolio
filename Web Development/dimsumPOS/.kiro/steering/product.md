# Product Steering — POS Dimsum & Es Teh

## Ringkasan Produk
Aplikasi Point of Sale (POS) berbasis web (PWA) untuk usaha penjualan **Dimsum** dan **Es Teh**.
Dapat "diinstall" langsung dari browser di HP / tablet / laptop tanpa proses instalasi native.

## Masalah yang Diselesaikan
1. Pemilik tidak tahu laba sebenarnya karena biaya kemasan (plastik, gelas, sedotan, mika/sterofoam) dan
   listrik tidak pernah dihitung ke dalam harga pokok.
2. Stok bahan baku dan kemasan habis tanpa terdeteksi.
3. Karyawan bisa melihat harga beli / margin — informasi yang seharusnya rahasia pemilik.

## Dua Sisi Aplikasi
| Sisi | Pengguna | Isi |
|---|---|---|
| **Stocking / Back Office** | `OWNER` (superadmin) | Master barang, satuan, pemasok, pembelian (harga beli), harga jual, resep/BOM, biaya operasional, kartu stok, laporan laba, manajemen pengguna & hak akses |
| **Penjualan / Kasir** | `KASIR` (staff) | Layar jual cepat, keranjang, pembayaran tunai/QRIS/transfer, struk, riwayat transaksi miliknya |

**Aturan mutlak:** `KASIR` tidak pernah bisa membuka halaman stocking, dan tidak pernah melihat
harga beli, HPP, atau laba — baik di UI maupun di response API.

## Katalog Awal
**Dimsum (dapat bertambah sewaktu-waktu — kelola lewat master barang, bukan hardcode):**
1. Dimsum Mentai
2. Dimsum Bakar
3. Dimsum Original
4. Dimsum Mini
5. Dimsum Birthday

**Minuman:**
1. Es Teh

**Barang non-jual (dibeli, dipakai, tidak dijual langsung):**
Plastik, gelas cup, sedotan, mika/sterofoam, tusuk, saus, dan lain-lain.

**Biaya operasional (bukan stok):** listrik, sewa, gas, transport, gaji.

## Prinsip Desain
- **Kecepatan kasir di atas segalanya** — target ≤ 3 ketukan dari buka aplikasi ke transaksi selesai.
- **Satu sumber kebenaran stok** — setiap perubahan stok wajib menghasilkan baris `pergerakan_stok`.
- **Angka tidak pernah dihitung ulang di frontend** — subtotal, HPP, dan laba dihitung di server.
- **Bahasa antarmuka: Indonesia.** Format uang `Rp1.234.567`, tanggal `dd MMM yyyy HH:mm` (WIB).
