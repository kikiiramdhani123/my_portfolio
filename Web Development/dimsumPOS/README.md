# POS Dimsum & Es Teh

Aplikasi Point of Sale berbasis web (PWA) untuk usaha dimsum dan es teh. Dibangun dengan
**Spec Driven Development** — spesifikasi lengkap ada di [`.kiro/`](.kiro/) dan menjadi acuan kode.

Dua sisi aplikasi:

| Sisi | Peran | Isi |
|---|---|---|
| **Back Office** `/admin` | `OWNER` | Barang, satuan, pemasok, pembelian & harga beli, resep, kartu stok, biaya, laporan laba, pengguna |
| **Kasir** `/kasir` | `KASIR` & `OWNER` | Layar jual cepat, keranjang, pembayaran, struk, riwayat |

`KASIR` tidak pernah bisa membuka halaman stok, dan **tidak pernah** menerima data harga beli,
HPP, atau laba — field-nya dipangkas di sisi server, bukan sekadar disembunyikan di UI.

---

## Menjalankan

### 1. Prasyarat
- Node.js 20+
- PostgreSQL 18 dengan database bernama `dimsumPos`

### 2. Konfigurasi
```bash
cp .env.example .env.local
```
Isi `.env.local`:
```
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/dimsumPos
SESSION_SECRET=string-acak-minimal-32-karakter
TZ=Asia/Jakarta
```

### 3. Pasang & siapkan database
```bash
npm install
npm run db:migrate     # buat seluruh tabel, indeks, dan trigger
npm run db:seed        # isi satuan, peran, pengguna, katalog, dan resep contoh
```

### 4. Jalankan

**Mode pengembangan** (untuk saat coding/uji coba fitur):
```bash
npm run dev
```

**Mode produksi** (untuk dipakai sungguhan sehari-hari di toko — lebih cepat, dan bisa
otomatis pulih sendiri kalau crash atau laptop restart):
```bash
npm run build          # sekali setiap kali ada perubahan kode
npm run prod:up        # jalankan via pm2 (auto-restart kalau crash)
```
Perintah pm2 lain: `npm run prod:status` (cek status), `npm run prod:log` (lihat log),
`npm run prod:down` (hentikan).

Buka <http://localhost:3000>.

### Akun bawaan
| Peran | Username | Kata Sandi |
|---|---|---|
| Pemilik | `owner` | `owner123` |
| Kasir | `kasir` | `kasir123` |

> Ganti kedua kata sandi lewat **Back Office → Pengguna** sebelum dipakai berjualan.

---

## Memakai dari beberapa HP / tablet di toko

**Konsep penting:** ini bukan aplikasi seperti Android (.exe/.apk) yang perlu diinstal di
tiap perangkat. Hanya **satu laptop** (disebut *server*) yang menjalankan seluruh proyek
ini + database. Perangkat lain (HP kasir, tablet, laptop kedua) **tidak perlu file apa
pun** — cukup browser, terhubung ke Wi‑Fi yang sama, dan tahu alamat laptop server.

```
Laptop (server): seluruh proyek + PostgreSQL + npm run prod:up
        │  Wi-Fi toko
        ├── HP Kasir 1   → browser saja, buka http://<ip-laptop>:3000
        ├── HP Kasir 2   → browser saja
        └── Tablet/Laptop lain → browser saja
```

### 1. Izinkan port 3000 di Windows Firewall (sekali saja, di laptop server)
Jalankan PowerShell sebagai **Administrator**:
```powershell
New-NetFirewallRule -DisplayName "POS Dimsum" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any
```

### 2. Cari alamat IP laptop di jaringan toko
```powershell
ipconfig | Select-String "IPv4"
```

### 3. Buka dari HP/tablet
`http://<ip-laptop>:3000` (contoh `http://192.168.1.10:3000`), lalu menu browser →
**Tambahkan ke Layar Utama** supaya ada ikonnya seperti aplikasi biasa (ini tetap membuka
alamat yang sama, bukan salinan terpisah). Catatan: fitur cache offline penuh (PWA) paling
optimal lewat HTTPS — lewat `http://` biasa di Wi‑Fi lokal aplikasi tetap berfungsi normal,
hanya sebagian kemampuan "app-like" mungkin tidak aktif penuh di sebagian HP.

### 4. Supaya IP laptop tidak berubah-ubah (penting!)
Router Wi‑Fi biasanya memberi IP acak (DHCP) tiap laptop dinyalakan ulang — kalau berubah,
semua HP kasir harus diketik ulang alamatnya. Dua pilihan, lakukan di **router/Wi‑Fi toko
yang sebenarnya** (bukan jaringan kantor/rumah untuk uji coba):

- **DHCP Reservation** (disarankan) — masuk ke halaman admin router (biasanya
  `192.168.0.1` atau `192.168.1.1`), cari menu *DHCP Reservation* / *Address Reservation*,
  lalu kunci salah satu IP untuk MAC address laptop server. Cari MAC address laptop dengan
  `ipconfig /all` (baris "Physical Address" pada adapter Wi‑Fi yang aktif). Langkah persis
  berbeda tiap merek router — cari "cara reservasi IP" + merek router Anda.
- **mDNS/hostname** (tanpa perlu masuk router sama sekali) — coba akses
  `http://<nama-komputer>.local:3000` dari HP (cari nama komputer lewat `hostname` di
  PowerShell). Tidak semua kombinasi router/HP mendukung ini secara konsisten — uji dulu
  sebelum diandalkan penuh.

### 5. Laptop server harus tetap menyala & tidak sleep
Selama toko buka, laptop tidak boleh mati/sleep — begitu laptop tidur, seluruh HP kasir
langsung terputus. Atur **Pengaturan → Daya & baterai → Sleep → Never** saat dicolok listrik.

---

## Menjalankan otomatis saat laptop menyala (pm2)

Sudah dikonfigurasi di proyek ini ([ecosystem.config.js](ecosystem.config.js)) memakai
[pm2](https://pm2.keymetrics.io/), sehingga:
- Aplikasi **otomatis restart sendiri** kalau proses crash (sudah diuji: proses dimatikan
  paksa, pm2 menghidupkannya lagi dalam hitungan detik).
- Aplikasi **otomatis jalan lagi setiap kali Anda login ke Windows** (pm2 terdaftar di
  Windows Startup lewat `pm2-windows-startup`).

Kalau ada perubahan pada `ecosystem.config.js` atau ingin menyimpan ulang daftar proses
setelah `pm2 start`/`pm2 stop` manual, jalankan `npx pm2 save` supaya tersimpan untuk
sesi berikutnya.

**Catatan penting:** ini menyala saat *login Windows*, bukan sebelum ada yang login sama
sekali. Untuk toko yang butuh laptop menyala tanpa harus ada yang login manual tiap pagi,
aktifkan **auto-login Windows** untuk akun ini (Settings → Accounts → Sign-in options, atau
`netplwiz`) — langkah ini sengaja tidak saya jalankan otomatis karena mengurangi keamanan
login laptop, jadi lakukan sendiri hanya jika toko benar-benar butuh itu.

PostgreSQL sudah otomatis menyala sebagai Windows Service (`StartType: Automatic`) —
tidak perlu pengaturan tambahan untuk database.

---

## Alur Kerja Harian

1. **Pemilik — belanja masuk.** Back Office → Pembelian → *Pembelian Baru*.
   Pilih barang, satuan beli (mis. DUS berisi 100 PCS), jumlah, dan harga beli.
   Stok naik dan **HPP rata-rata bergerak** dihitung otomatis.
2. **Pemilik — atur resep.** Back Office → Resep. Tentukan bahan dan kemasan tiap produk
   (mis. 1 Es Teh = 5 gram teh + 30 ml gula + 150 gram es + 1 gelas + 1 sedotan).
3. **Karyawan — berjualan.** `/kasir` → ketuk produk → Bayar → struk.
   Setiap penjualan otomatis mengurangi stok seluruh bahan resepnya.
4. **Pemilik — catat biaya.** Back Office → Biaya. Listrik, sewa, gas: tidak masuk stok,
   tetapi mengurangi laba bersih.
5. **Pemilik — lihat hasil.** Dasbor & Laporan: omzet, HPP, laba kotor, laba bersih,
   produk terlaris, stok menipis. Semua dapat diunduh CSV.

### Menambah menu dimsum baru
Back Office → **Barang** → *Barang Baru* (centang **Dapat dijual**, isi harga jual dan emoji),
lalu buat **Resep**-nya. Tidak ada kode yang perlu diubah.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan di `0.0.0.0:3000` |
| `npm run build` / `npm start` | Build & jalankan mode produksi (manual, tanpa auto-restart) |
| `npm run prod:up` | Build lalu jalankan via **pm2** (auto-restart, dipakai di toko) |
| `npm run prod:down` / `prod:status` / `prod:log` | Hentikan / cek status / lihat log pm2 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Terapkan migrasi SQL yang belum dijalankan |
| `npm run db:seed` | Isi data **contoh** (katalog dimsum/es teh demo, aman diulang) |
| `npm run db:seed:kosong` | Isi data **kosong** — hanya peran/hak akses + 1 akun OWNER (env `OWNER_NAMA`, `OWNER_USERNAME`, `OWNER_SANDI`) |
| `npm run db:reset` | **Hapus semua data**, lalu migrate + seed **contoh** ulang |
| `npm run db:reset:kosong` | **Hapus semua data**, lalu migrate + seed **kosong** (mulai bisnis dari nol) |
| `npm test` | Uji unit & integrasi (butuh database) |
| `npm run test:http` | Uji otorisasi (butuh server berjalan) |

---

## Keputusan Teknis Penting

- **HPP: Weighted Average (rata-rata bergerak).** Dihitung ulang tiap barang masuk, lalu
  di-*snapshot* ke `detail_penjualan.hpp_satuan` saat penjualan, sehingga laporan lama tidak
  berubah ketika harga beli naik.
- **Uang memakai `NUMERIC` + aritmetika BigInt** ([`src/lib/money.ts`](src/lib/money.ts)).
  Tidak ada `float` di jalur perhitungan, sehingga total laporan selalu sama dengan jumlah barisnya.
- **Kartu stok bersifat append-only.** Trigger database menolak `UPDATE`/`DELETE` pada
  `pergerakan_stok`; koreksi dilakukan lewat pergerakan pembalik atau penyesuaian opname.
- **Setiap transaksi atomik.** Penjualan dan pembelian dibungkus satu transaksi database —
  gagal di tengah berarti stok tidak berubah sama sekali.
- **Idempotensi kasir.** Tiap pembayaran membawa `idempotency_key`; koneksi putus lalu kirim ulang
  tidak akan menggandakan transaksi.
- **Otorisasi tiga lapis.** `middleware.ts` → layout `(admin)` → `requirePermission()` di tiap API.

---

## Struktur Proyek

```
.kiro/
  steering/    product.md · tech.md · structure.md
  specs/pos-dimsum-esteh/
               requirements.md · design.md · tasks.md
db/migrations/ skema SQL berurutan (hanya append)
scripts/       migrate · seed · reset
src/
  app/         halaman + route handler API
  components/  ui/ · kasir/ · admin/
  lib/         db · auth · rbac · money · stok · hpp · penjualan · pembelian · resep · laporan
tests/         unit · integrasi · otorisasi
```

Baca [`.kiro/specs/pos-dimsum-esteh/requirements.md`](.kiro/specs/pos-dimsum-esteh/requirements.md)
sebelum mengubah perilaku bisnis — setiap fungsi di `src/lib/` menyebut nomor requirement yang dipenuhinya.
