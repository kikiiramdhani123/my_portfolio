# Requirements — Olist Batch Pipeline

> Dokumen ini menjawab **"APA"** yang harus dibangun. Bagaimana cara membangunnya ada di [design.md](design.md),
> dan urutan pengerjaannya ada di [tasks.md](tasks.md).
>
> Format acceptance criteria mengikuti gaya **EARS** (*Easy Approach to Requirements Syntax*) seperti yang dipakai Kiro:
> `WHEN <kondisi> THE SYSTEM SHALL <perilaku>`.

## Latar Belakang

Olist adalah marketplace e-commerce Brasil. Dataset publiknya (Kaggle, ±100 ribu order, 2016–2018) tersebar di
9 file CSV yang belum bersih: ada duplikat, nilai kosong, tanggal masih berupa teks, dan beberapa baris tidak valid.
Pipeline ini mengubah file mentah tersebut menjadi tabel PostgreSQL yang bersih dan siap dianalisis, ditambah
tabel ringkasan (agregasi) untuk kebutuhan dashboard/reporting.

## Glosarium

| Istilah | Arti |
|---|---|
| **Layer raw** | Salinan data sumber apa adanya (semua kolom `TEXT`). Tujuannya audit & bisa replay tanpa membaca ulang sumber. |
| **Layer clean** | Data yang sudah dibersihkan, bertipe benar, punya primary key & foreign key. |
| **Layer mart** | Tabel ringkasan (agregasi) yang siap dipakai analis/dashboard. |
| **Full refresh** | Setiap run, isi tabel dikosongkan lalu diisi ulang penuh. Hasil run ke-1 dan ke-2 identik (*idempotent*). |
| **BRL** | Real Brasil, mata uang seluruh transaksi di dataset. |

## Profil Data Sumber (hasil profiling awal)

Angka di bawah ini didapat dari profiling sebelum desain dibuat, dan menjadi dasar aturan transformasi.

| File | Baris | Temuan |
|---|---:|---|
| `olist_orders_dataset.csv` | 99.441 | Null: `order_approved_at` 160, `order_delivered_carrier_date` 1.783, `order_delivered_customer_date` 2.965. 8 status order. |
| `olist_order_items_dataset.csv` | 112.650 | Bersih. Key `(order_id, order_item_id)` unik. |
| `olist_order_payments_dataset.csv` | 103.886 | 9 baris `payment_value` = 0, 3 baris `payment_type = not_defined`, 2 baris `payment_installments` = 0. |
| `olist_order_reviews_dataset.csv` | 99.224 | `review_id` **tidak unik** (814 duplikat) → key yang benar `(review_id, order_id)`. Komentar banyak yang kosong. |
| `olist_products_dataset.csv` | 32.951 | 610 produk tanpa kategori, 2 produk tanpa dimensi. Nama kolom typo (`lenght`). |
| `olist_customers_dataset.csv` | 99.441 | Bersih. Zip code diawali nol (`01037`) — rawan hilang kalau dibaca sebagai angka. |
| `olist_sellers_dataset.csv` | 3.095 | Bersih. |
| `olist_geolocation_dataset.csv` | 1.000.163 | **261.831 baris duplikat penuh**; satu zip code punya banyak koordinat. |
| `product_category_name_translation.csv` | 71 | File ber-BOM (UTF-8 with BOM). 2 kategori produk tidak punya terjemahan: `pc_gamer`, `portateis_cozinha_e_preparadores_de_alimentos`. |

**Profiling lanjutan (anomali logis)** — ditemukan sebelum Task 6 dan menjadi dasar Requirement 6.4–6.6 dan 8.5–8.13:

| Temuan | Jumlah |
|---|---:|
| Order diserahkan ke kurir **sebelum dibeli** | 166 |
| Order diserahkan ke kurir sebelum pembayaran di-approve (proporsi tipe bayar sama dengan populasi → bukan proses bisnis) | 1.359 |
| Order diterima customer **sebelum diserahkan ke kurir** | 23 |
| Order tanpa item dengan status selain `canceled`/`unavailable` | 8 |
| Review dibuat **sebelum order dibeli** | 64 |
| Item dengan batas kirim > 90 hari setelah pembelian (maks 1.056 hari, sampai tahun 2020) | 8 |
| Produk dengan berat 0 gram | 4 |
| Komentar review dengan spasi berlebih / baris baru / hanya spasi | ± 11 ribu |
| Kota seller tidak standar: beraksen, `/sp`, `, brasil`, zip code (`04482255`), email, singkatan (`sbc`) | 27 |
| Kota geolocation beraksen/rusak (`são paulo`, `sa£o paulo`) | 2.085 varian |
| Zip geolocation dengan > 1 negara bagian | 8 |

---

## Requirement 1 — Extract data dari file CSV

**User story:** Sebagai data engineer, saya ingin semua file CSV Olist terbaca utuh tanpa kehilangan informasi,
agar layer raw benar-benar mencerminkan sumber.

**Acceptance criteria**

1. WHEN pipeline dijalankan THE SYSTEM SHALL membaca ke-9 file CSV dari folder `data/`.
2. WHEN membaca CSV THE SYSTEM SHALL memperlakukan semua kolom sebagai teks, agar nilai seperti zip code `01037` tidak berubah menjadi `1037`.
3. WHEN sebuah file memakai BOM THE SYSTEM SHALL tetap membaca nama kolom dengan benar.
4. IF sebuah file tidak ditemukan atau kolomnya tidak sesuai yang diharapkan THEN THE SYSTEM SHALL menghentikan pipeline dengan pesan error yang menyebut nama file-nya.
5. WHEN extract selesai THE SYSTEM SHALL mencatat (log) jumlah baris per file.

## Requirement 2 — Extract data dari API publik (kurs BRL→USD)

**User story:** Sebagai analis, saya ingin melihat revenue dalam USD, agar bisa dibandingkan dengan data internasional.

**Acceptance criteria**

1. WHEN pipeline dijalankan THE SYSTEM SHALL mengambil kurs harian BRL→USD dari Frankfurter API untuk rentang tanggal order di dataset.
2. IF request API gagal THEN THE SYSTEM SHALL mencoba ulang (retry) maksimal 3 kali dengan jeda bertambah.
3. IF API tetap gagal setelah retry THEN THE SYSTEM SHALL menghentikan pipeline dengan pesan error yang jelas.

## Requirement 3 — Load layer raw

**User story:** Sebagai data engineer, saya ingin data mentah tersimpan di database apa adanya, agar saya bisa
mengaudit dan menjalankan ulang transformasi tanpa harus membaca ulang sumber.

**Acceptance criteria**

1. WHEN load raw dijalankan THE SYSTEM SHALL menyimpan setiap sumber ke tabel `raw.<nama_sumber>` tanpa mengubah isi datanya.
2. WHEN load raw dijalankan berulang kali THE SYSTEM SHALL menghasilkan jumlah baris yang sama (full refresh, idempotent).
3. WHEN baris dimuat THE SYSTEM SHALL mengisi kolom `_loaded_at` dengan waktu load.

## Requirement 4 — Transform: hapus duplikat

1. WHEN ada baris yang duplikat penuh THE SYSTEM SHALL menyimpan satu saja.
2. WHEN ada lebih dari satu baris dengan primary key yang sama THE SYSTEM SHALL menyimpan satu baris saja per key.
3. WHEN data geolocation diproses THE SYSTEM SHALL menghasilkan tepat satu baris per zip code prefix.

## Requirement 5 — Transform: handle missing values

1. WHEN produk tidak punya kategori THE SYSTEM SHALL mengisinya dengan `unknown`.
2. WHEN kategori tidak punya terjemahan Inggris THE SYSTEM SHALL mengisinya dengan terjemahan manual (untuk kategori yang diketahui) atau nama aslinya.
3. WHEN atribut numerik produk kosong THE SYSTEM SHALL membiarkannya `NULL` (bukan 0), karena 0 gram/0 cm adalah nilai yang salah, bukan "tidak diketahui".
4. WHEN timestamp pengiriman kosong karena order belum terkirim THE SYSTEM SHALL membiarkannya `NULL`.
5. WHEN komentar review kosong atau hanya berisi spasi THE SYSTEM SHALL menjadikannya `NULL` dan mengisi flag `has_comment = false`.
6. WHEN tanggal kurs tidak tersedia (akhir pekan/libur) THE SYSTEM SHALL memakai kurs hari kerja terakhir (*forward fill*) dan menandainya `is_filled = true`.

## Requirement 6 — Transform: seragamkan format tanggal & teks

1. WHEN kolom tanggal/waktu diproses THE SYSTEM SHALL mengubahnya menjadi tipe `TIMESTAMP` atau `DATE` (bukan teks).
2. THE SYSTEM SHALL memakai konvensi penamaan seragam: kolom waktu berakhiran `_at` (TIMESTAMP), kolom tanggal berakhiran `_date` (DATE).
3. IF sebuah nilai tanggal tidak bisa di-parse THEN THE SYSTEM SHALL menganggapnya `NULL` dan mencatat jumlahnya di log.
4. WHEN nama kota diproses THE SYSTEM SHALL menyeragamkannya: huruf kecil, tanpa aksen (`são paulo` → `sao paulo`), tanpa karakter rusak (`sa£o paulo`), tanpa akhiran negara bagian (`maua/sao paulo` → `maua`), dan spasi tunggal.
5. IF nama kota seller/customer tidak valid (berupa angka, email, kode negara bagian, atau singkatan) THEN THE SYSTEM SHALL menggantinya dengan kota dari tabel geolocation berdasarkan zip code, atau `NULL` jika tidak ditemukan.
6. WHEN teks komentar review diproses THE SYSTEM SHALL membuang spasi di awal/akhir dan menyatukan spasi/baris baru berulang menjadi satu spasi.

## Requirement 7 — Transform: kolom kalkulasi baru

1. THE SYSTEM SHALL menghitung `delivery_days` (hari dari pembelian sampai diterima customer) untuk order yang sudah terkirim.
2. THE SYSTEM SHALL menghitung `delivery_delay_days` dan flag `is_late` (diterima melewati estimasi).
3. THE SYSTEM SHALL menghitung `total_item_value = price + freight_value` per item.
4. THE SYSTEM SHALL menghitung `volume_cm3 = length × height × width` per produk.
5. THE SYSTEM SHALL menghitung `response_hours` (jeda antara review dibuat dan dijawab).
6. THE SYSTEM SHALL menghitung nilai revenue dalam USD memakai kurs pada tanggal pembelian.

## Requirement 8 — Transform: filter & koreksi data invalid

**Prinsip penanganan anomali** (diterapkan berurutan):

| Kondisi | Tindakan | Contoh |
|---|---|---|
| Nilai salah, tapi nilai benarnya bisa dipastikan | **Koreksi** | cicilan 0 → 1 |
| Satu kolom salah, sisa baris valid & kolom itu tidak inti | **Jadikan NULL** (baris dipertahankan) | tanggal serah ke kurir sebelum tanggal beli |
| Baris kontradiktif / tidak lengkap sehingga merusak metrik | **Buang baris** | review dibuat sebelum order dibeli |
| Nilai ekstrem tapi masih mungkin terjadi | **Pertahankan** (outlier ≠ invalid) | pengiriman 209 hari |

**Acceptance criteria**

1. IF `payment_value <= 0` atau `payment_type = 'not_defined'` THEN THE SYSTEM SHALL membuang baris pembayaran tersebut.
2. IF `payment_installments = 0` THEN THE SYSTEM SHALL mengoreksinya menjadi 1 (pembayaran minimal 1 kali cicilan).
3. IF `review_score` di luar 1–5 THEN THE SYSTEM SHALL membuang baris review tersebut.
4. IF koordinat geolocation berada di luar batas wilayah Brasil THEN THE SYSTEM SHALL membuang baris tersebut.
5. IF `delivered_carrier_at` lebih awal dari `purchase_at` atau `approved_at`, atau lebih lambat dari `delivered_customer_at` THEN THE SYSTEM SHALL menjadikan `delivered_carrier_at` bernilai `NULL` (order tetap dipertahankan).
6. IF `delivered_customer_at` atau `approved_at` lebih awal dari `purchase_at` THEN THE SYSTEM SHALL membuang order tersebut.
7. IF order tidak punya item dan statusnya bukan `canceled`/`unavailable` THEN THE SYSTEM SHALL membuang order tersebut (order tidak lengkap).
8. IF review dibuat sebelum tanggal pembelian order-nya THEN THE SYSTEM SHALL membuang review tersebut.
9. IF `shipping_limit_at` lebih dari 90 hari setelah pembelian THEN THE SYSTEM SHALL menjadikannya `NULL`.
10. IF berat produk 0 gram THEN THE SYSTEM SHALL menjadikannya `NULL` (berat 0 mustahil secara fisik).
11. WHEN sebuah order dibuang THE SYSTEM SHALL ikut membuang item, payment, dan review milik order itu (menjaga integritas referensial).
12. WHEN filter/koreksi dijalankan THE SYSTEM SHALL mencatat jumlah baris yang terdampak per aturan di log.
13. WHEN transform selesai THE SYSTEM SHALL menjalankan *data quality check* pada semua tabel clean (PK, FK, domain nilai, urutan waktu, format teks). IF ada satu check yang gagal THEN THE SYSTEM SHALL menghentikan pipeline **sebelum** load.

**Sengaja dipertahankan (bukan anomali)** — dicatat agar pembaca tahu ini keputusan sadar, bukan terlewat:

| Temuan | Alasan dipertahankan |
|---|---|
| 43 order dengan pengiriman > 120 hari (maks 209) | Outlier, bukan invalid. Urutan waktunya logis. |
| 249 order dengan total payment ≠ total item (> 1 BRL) | Payment mencakup bunga cicilan/voucher. Revenue memakai item (lihat design §3.3). |
| 80 order dengan `payment_sequential` tidak berurutan | Nomor urut adalah ID dari sumber; mengubahnya merusak *lineage*. |
| 1 order `delivered` tanpa data payment | Item & pengiriman lengkap; revenue dihitung dari item. |
| 8 order `delivered` tanpa `delivered_customer_at`, 14 tanpa `approved_at` | Nilai yang hilang (missing), bukan nilai yang salah. Dikecualikan dari metrik pengiriman. |
| 6 order `canceled` yang punya tanggal diterima | Mungkin diterima lalu dibatalkan/diretur. Tidak masuk revenue maupun metrik pengiriman. |
| 547 order dengan > 1 review | Semua review disimpan di clean; mart memakai review terakhir per order. |
| 3.345 customer (`customer_unique_id`) dengan > 1 `customer_id` | Desain sumber: `customer_id` dibuat per order. |

## Requirement 9 — Load layer clean

1. WHEN load clean dijalankan THE SYSTEM SHALL menyimpan data ke tabel `clean.*` dengan tipe data, primary key, dan foreign key yang benar.
2. WHEN load clean dijalankan THE SYSTEM SHALL memuat tabel induk sebelum tabel anak (urutan foreign key).
3. IF load gagal di tengah jalan THEN THE SYSTEM SHALL membatalkan (rollback) seluruh load layer tersebut, sehingga database tidak berisi data setengah jadi.

## Requirement 10 — Load layer mart (summary)

**User story:** Sebagai analis, saya ingin tabel ringkasan yang siap pakai, agar tidak perlu menulis query join yang rumit.

1. THE SYSTEM SHALL membuat `mart.daily_sales` — penjualan per hari.
2. THE SYSTEM SHALL membuat `mart.monthly_category_sales` — penjualan per bulan per kategori produk.
3. THE SYSTEM SHALL membuat `mart.seller_performance` — performa per seller.
4. THE SYSTEM SHALL membuat `mart.state_delivery_summary` — performa pengiriman per negara bagian customer.
5. THE SYSTEM SHALL menghitung revenue hanya dari order yang statusnya bukan `canceled` atau `unavailable`.
6. WHEN tabel mart selesai dibangun THE SYSTEM SHALL melakukan **rekonsiliasi**: total revenue di keempat tabel mart harus sama dengan total revenue item penjualan di layer clean, dan jumlah order di `daily_sales` & `state_delivery_summary` harus sama dengan jumlah order penjualan. IF tidak sama THEN THE SYSTEM SHALL menghentikan pipeline sebelum load mart.
7. WHEN tabel mart selesai dibangun THE SYSTEM SHALL memeriksa domain nilai: rate di antara 0–1, skor review di antara 1–5, jumlah & revenue tidak negatif, primary key unik.

## Requirement 11 — Orkestrasi, konfigurasi, dan observability

1. WHEN `python main.py` dijalankan THE SYSTEM SHALL menjalankan seluruh tahap secara berurutan: extract → load raw → transform → load clean → load mart.
2. THE SYSTEM SHALL membaca koneksi database dari environment variable `DATABASE_URI` (file `.env`), tidak pernah di-hardcode di kode.
3. WHEN setiap tahap selesai THE SYSTEM SHALL mencatat durasi dan jumlah baris yang diproses.
4. IF sebuah tahap gagal THEN THE SYSTEM SHALL mencatat error dan keluar dengan exit code ≠ 0.

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Satu kali run penuh selesai < 10 menit di laptop biasa. |
| NFR-2 | Kredensial (`.env`) dan data mentah (`data/`) tidak ikut di-commit ke Git. |
| NFR-3 | Fungsi transformasi bersifat *pure function* (input DataFrame → output DataFrame) sehingga bisa di-unit test tanpa database. |
| NFR-4 | Struktur tabel didefinisikan eksplisit di file SQL (`sql/`) dan ikut versioning. |

## Out of Scope

- Scheduler (Airflow/cron) — pipeline dijalankan manual.
- Incremental load / CDC — memakai full refresh.
- Dashboard/visualisasi.
