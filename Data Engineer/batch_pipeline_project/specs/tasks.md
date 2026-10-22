# Tasks — Olist Batch Pipeline

> Rencana implementasi berdasarkan [design.md](design.md). Kerjakan berurutan; setiap task menyebut requirement
> yang dipenuhinya. Centang `[x]` setelah task selesai **dan** sudah diverifikasi.
>
> 🧑 = dijalankan manual oleh kamu (di terminal/DBMS) · 🐍 = kode Python di repo ini

- [x] **1. Setup environment** 🧑
  - [x] 1.1 Buat virtual environment & install dependency dari `requirements.txt`
  - [x] 1.2 Pastikan `.env` berisi `DATABASE_URI` dan `.gitignore` mengecualikan `.env` & `data/`
  - _Requirements: 11.2, NFR-2_

- [x] **2. Buat schema & tabel di PostgreSQL** 🧑
  - [x] 2.1 Jalankan `sql/00_schemas.sql`
  - [x] 2.2 Jalankan `sql/01_raw_tables.sql`
  - [x] 2.3 Jalankan `sql/02_clean_tables.sql`
  - [x] 2.4 Jalankan `sql/03_mart_tables.sql`
  - [x] 2.5 Verifikasi: 10 tabel raw, 10 tabel clean, 4 tabel mart
  - _Requirements: 3.1, 9.1, 10.1–10.4, NFR-4_

- [x] **3. Konfigurasi & koneksi database** 🐍
  - [x] 3.1 `config.py`: path folder data, mapping file CSV → tabel raw, URL API, batas koordinat Brasil
  - [x] 3.2 `load/load.py::get_engine()` membaca `DATABASE_URI` dari `.env`
  - [x] 3.3 Tes koneksi (`SELECT 1`) — `python -m load.load`
  - _Requirements: 11.2_

- [x] **4. Extract** 🐍
  - [x] 4.1 `extract_csv_files()` — baca 9 CSV sebagai teks (`dtype=str`, `encoding="utf-8-sig"`), validasi kolom
  - [x] 4.2 `extract_exchange_rates()` — panggil Frankfurter API dengan timeout & retry
  - [x] 4.3 Log jumlah baris per sumber — `python -m extract.extract`
  - _Requirements: 1.1–1.5, 2.1–2.3_

- [x] **5. Load raw** 🐍
  - [x] 5.1 `load_raw()` — `TRUNCATE` semua tabel raw lalu `COPY`, dalam satu transaksi
  - [x] 5.2 Verifikasi jumlah baris raw = jumlah baris CSV; jalankan 2× hasilnya sama; uji rollback saat gagal
  - _Requirements: 3.1–3.3, 9.3_

- [x] **6. Transform → clean** 🐍
  - [x] 6.0 Profiling lanjutan anomali logis → spec diperbarui (Req 6.4–6.6, 8.5–8.13, design §4)
  - [x] 6.1 Dimensi: `category_translation`, `geolocation`, `customers`, `sellers`, `products` + normalisasi kota
  - [x] 6.2 `exchange_rates` dengan forward fill
  - [x] 6.3 `orders`: parsing tanggal, kolom kalkulasi, koreksi urutan waktu carrier
  - [x] 6.4 `order_items`, `order_payments`, `order_reviews` + buang anak dari order yang dibuang
  - [x] 6.5 `transform_all()` menyatukan semuanya + log baris terdampak per aturan
  - [x] 6.6 `transform/quality.py`: 121 data quality check; diverifikasi dengan mutation test (18/18 anomali tertangkap)
  - [x] 6.7 🧑 Buat ulang schema clean dengan DDL terbaru (constraint urutan waktu, berat > 0, `shipping_limit_at` nullable)
  - _Requirements: 4.1–4.3, 5.1–5.6, 6.1–6.6, 7.1–7.5, 8.1–8.13_

- [x] **7. Load clean** 🐍
  - [x] 7.1 `load_tables()` — `TRUNCATE` semua tabel dalam satu statement (tanpa `CASCADE`) lalu `to_sql(append)` sesuai urutan FK, satu transaksi
  - [x] 7.2 Verifikasi: NULL per kolom & agregat DB = DataFrame; anomali yang mem-bypass quality check ditolak constraint DB (CHECK/FK/PK) dan di-rollback; load ulang idempotent
  - _Requirements: 9.1–9.3_

- [x] **8. Summary → mart** 🐍
  - [x] 8.1 `transform/summary.py::build_summaries()` — 4 tabel agregat sesuai definisi metrik di design §3.3
  - [x] 8.2 `validate_summaries()` — 50 check: domain nilai + rekonsiliasi revenue per baris & jumlah order terhadap clean
  - [x] 8.3 Load ke schema `mart`
  - [x] 8.4 Verifikasi: 4 tabel mart = implementasi SQL independen (100% baris & kolom); mutation test 10/10
  - _Requirements: 7.6, 10.1–10.7_

- [x] **9. Orkestrasi `main.py`** 🐍
  - [x] 9.1 Jalankan semua tahap berurutan, log durasi per tahap, ringkasan run, exit code 1 jika gagal
  - [x] 9.2 Uji jalur gagal: DB mati, password salah, API mati (retry 3×), data quality gagal → semua exit code 1 & layer clean/mart tetap utuh
  - [x] 9.3 `connect_timeout` 10 detik (sebelumnya DB mati membuat pipeline menggantung 260 detik)
  - _Requirements: 11.1, 11.3, 11.4, NFR-1_

- [x] **10. Testing & verifikasi** 🐍🧑
  - [x] 10.1 `pytest`: 72 test — extract (BOM, retry API ter-mock), setiap aturan transform, nilai mart vs hitungan manual,
        mutation test clean & mart, regression test dataset lengkap (`slow`). Tanpa database & internet.
  - [x] 10.2 🧑 Jalankan `sql/04_verify.sql` di DBMS: aturan lintas tabel, rekonsiliasi revenue, mart vs SQL murni
        → jumlah baris semua layer sesuai; 7 aturan lintas tabel = 0 pelanggaran; selisih revenue clean vs
        4 tabel mart = 0.00 (total R$ 15.735.527,03); 4 query mart vs SQL murni = 0 baris berbeda
  - _Requirements: NFR-3_

- [x] **11. Dokumentasi portofolio** 🐍
  - [x] 11.1 `README.md`: tujuan, arsitektur, cara menjalankan, contoh hasil query mart, pelajaran yang didapat
        → ditulis untuk pembaca non-IT & recruiter (analogi, glosarium); angka diambil dari run 2026-10-22 (62 detik)
