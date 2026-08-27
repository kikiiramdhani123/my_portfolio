-- 001_skema_inti.sql — seluruh tabel POS Dimsum & Es Teh
-- Requirement: 3.1, 4.1, 5.1, 6.7, 7.1, 8.1, 11.1, 11.2

-- ============================================================
-- IDENTITAS & HAK AKSES
-- ============================================================
CREATE TABLE peran (
  id_peran    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama_peran  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE hak_akses (
  id_hak_akses    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_hak_akses  VARCHAR(80)  NOT NULL UNIQUE,
  nama_hak_akses  VARCHAR(100) NOT NULL
);

CREATE TABLE peran_hak_akses (
  id_peran      BIGINT  NOT NULL REFERENCES peran(id_peran) ON DELETE CASCADE,
  id_hak_akses  BIGINT  NOT NULL REFERENCES hak_akses(id_hak_akses) ON DELETE CASCADE,
  boleh_lihat   BOOLEAN NOT NULL DEFAULT FALSE,
  boleh_tambah  BOOLEAN NOT NULL DEFAULT FALSE,
  boleh_ubah    BOOLEAN NOT NULL DEFAULT FALSE,
  boleh_hapus   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_peran, id_hak_akses)
);

CREATE TABLE pengguna (
  id_pengguna      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama_pengguna    VARCHAR(150) NOT NULL,
  username         VARCHAR(80)  NOT NULL UNIQUE,
  kata_sandi_hash  VARCHAR(255) NOT NULL,
  status_aktif     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE pengguna_peran (
  id_pengguna BIGINT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE CASCADE,
  id_peran    BIGINT NOT NULL REFERENCES peran(id_peran)       ON DELETE RESTRICT,
  PRIMARY KEY (id_pengguna, id_peran)
);

-- Req 1.8 — pembatasan percobaan login
CREATE TABLE percobaan_login (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username  VARCHAR(80) NOT NULL,
  waktu     TIMESTAMPTZ NOT NULL DEFAULT now(),
  berhasil  BOOLEAN     NOT NULL,
  ip        VARCHAR(64)
);
CREATE INDEX idx_percobaan_login ON percobaan_login (username, waktu DESC);

-- ============================================================
-- MASTER BARANG
-- ============================================================
CREATE TABLE satuan (
  id_satuan    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_satuan  VARCHAR(20) NOT NULL UNIQUE,
  nama_satuan  VARCHAR(50) NOT NULL
);

CREATE TABLE barang (
  id_barang        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_barang      VARCHAR(50)  NOT NULL UNIQUE,
  nama_barang      VARCHAR(150) NOT NULL,
  jenis_barang     VARCHAR(30)  NOT NULL
                   CHECK (jenis_barang IN ('MAKANAN','MINUMAN','BAHAN','KEMASAN','LAINNYA')),
  id_satuan_dasar  BIGINT       NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  dapat_dijual     BOOLEAN      NOT NULL DEFAULT FALSE,
  dapat_dibeli     BOOLEAN      NOT NULL DEFAULT TRUE,
  status_aktif     BOOLEAN      NOT NULL DEFAULT TRUE,
  stok_minimum     NUMERIC(18,6) NOT NULL DEFAULT 0,
  warna_kartu      VARCHAR(20),
  emoji            VARCHAR(8),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_barang_jual ON barang (dapat_dijual, status_aktif);

CREATE TABLE satuan_barang (
  id_satuan_barang          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_barang                 BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE CASCADE,
  id_satuan                 BIGINT NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  konversi_ke_satuan_dasar  NUMERIC(18,6) NOT NULL CHECK (konversi_ke_satuan_dasar > 0),
  harga_jual                NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),
  barcode                   VARCHAR(100) UNIQUE,
  adalah_satuan_default     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (id_barang, id_satuan)
);
CREATE INDEX idx_satuan_barang_barang ON satuan_barang (id_barang);

-- ============================================================
-- PEMASOK & PEMBELIAN
-- ============================================================
CREATE TABLE pemasok (
  id_pemasok    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_pemasok  VARCHAR(50)  NOT NULL UNIQUE,
  nama_pemasok  VARCHAR(150) NOT NULL,
  nomor_telepon VARCHAR(30),
  alamat        TEXT,
  status_aktif  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pembelian (
  id_pembelian           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nomor_faktur_pembelian VARCHAR(80) NOT NULL UNIQUE,
  tanggal_pembelian      TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_pemasok             BIGINT REFERENCES pemasok(id_pemasok) ON DELETE RESTRICT,
  subtotal               NUMERIC(18,2) NOT NULL DEFAULT 0,
  diskon                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  pajak                  NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_pembelian        NUMERIC(18,2) NOT NULL DEFAULT 0,
  status_pembelian       VARCHAR(30) NOT NULL DEFAULT 'SELESAI'
                         CHECK (status_pembelian IN ('DRAFT','SELESAI','BATAL')),
  catatan                TEXT,
  id_pengguna            BIGINT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pembelian_tanggal ON pembelian (tanggal_pembelian DESC);

CREATE TABLE detail_pembelian (
  id_detail_pembelian      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pembelian             BIGINT NOT NULL REFERENCES pembelian(id_pembelian) ON DELETE CASCADE,
  id_barang                BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE RESTRICT,
  id_satuan                BIGINT NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  jumlah                   NUMERIC(18,6) NOT NULL CHECK (jumlah > 0),
  harga_beli_satuan        NUMERIC(18,2) NOT NULL CHECK (harga_beli_satuan >= 0),
  konversi_ke_satuan_dasar NUMERIC(18,6) NOT NULL CHECK (konversi_ke_satuan_dasar > 0),
  jumlah_satuan_dasar      NUMERIC(18,6) NOT NULL,
  subtotal                 NUMERIC(18,2) NOT NULL
);
CREATE INDEX idx_detail_pembelian_barang ON detail_pembelian (id_barang);
CREATE INDEX idx_detail_pembelian_header ON detail_pembelian (id_pembelian);

-- ============================================================
-- RESEP (BOM)
-- ============================================================
CREATE TABLE resep (
  id_resep        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_barang_hasil BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE CASCADE,
  nama_resep      VARCHAR(150) NOT NULL,
  versi_resep     INT NOT NULL DEFAULT 1,
  tanggal_berlaku DATE NOT NULL DEFAULT CURRENT_DATE,
  status_aktif    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_barang_hasil, versi_resep)
);
-- Req 5.2 — hanya satu resep aktif per barang hasil
CREATE UNIQUE INDEX idx_resep_aktif_unik ON resep (id_barang_hasil) WHERE status_aktif;

CREATE TABLE detail_resep (
  id_detail_resep BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_resep        BIGINT NOT NULL REFERENCES resep(id_resep) ON DELETE CASCADE,
  id_barang_bahan BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE RESTRICT,
  id_satuan       BIGINT NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  jumlah          NUMERIC(18,6) NOT NULL CHECK (jumlah > 0),
  catatan         VARCHAR(255)
);
CREATE INDEX idx_detail_resep_header ON detail_resep (id_resep);

-- ============================================================
-- PENJUALAN
-- ============================================================
CREATE TABLE penjualan (
  id_penjualan      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nomor_transaksi   VARCHAR(80) NOT NULL UNIQUE,
  tanggal_penjualan TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_pengguna       BIGINT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT,
  subtotal          NUMERIC(18,2) NOT NULL DEFAULT 0,
  diskon            NUMERIC(18,2) NOT NULL DEFAULT 0,
  pajak             NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_penjualan   NUMERIC(18,2) NOT NULL DEFAULT 0,
  jumlah_bayar      NUMERIC(18,2) NOT NULL DEFAULT 0,
  jumlah_kembalian  NUMERIC(18,2) NOT NULL DEFAULT 0,
  metode_pembayaran VARCHAR(30) NOT NULL DEFAULT 'TUNAI'
                    CHECK (metode_pembayaran IN ('TUNAI','QRIS','TRANSFER')),
  status_penjualan  VARCHAR(30) NOT NULL DEFAULT 'SELESAI'
                    CHECK (status_penjualan IN ('SELESAI','BATAL')),
  idempotency_key   VARCHAR(120) UNIQUE,
  catatan           TEXT
);
CREATE INDEX idx_penjualan_tanggal        ON penjualan (tanggal_penjualan DESC);
CREATE INDEX idx_penjualan_status_tanggal ON penjualan (status_penjualan, tanggal_penjualan);
CREATE INDEX idx_penjualan_pengguna       ON penjualan (id_pengguna, tanggal_penjualan DESC);

CREATE TABLE detail_penjualan (
  id_detail_penjualan      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_penjualan             BIGINT NOT NULL REFERENCES penjualan(id_penjualan) ON DELETE CASCADE,
  id_barang                BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE RESTRICT,
  id_satuan                BIGINT NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  jumlah                   NUMERIC(18,6) NOT NULL CHECK (jumlah > 0),
  harga_jual_satuan        NUMERIC(18,2) NOT NULL,
  konversi_ke_satuan_dasar NUMERIC(18,6) NOT NULL,
  jumlah_satuan_dasar      NUMERIC(18,6) NOT NULL,
  diskon_baris             NUMERIC(18,2) NOT NULL DEFAULT 0,
  hpp_satuan               NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_hpp                NUMERIC(18,2) NOT NULL DEFAULT 0,
  subtotal_penjualan       NUMERIC(18,2) NOT NULL DEFAULT 0,
  laba_kotor               NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_detail_penjualan_barang ON detail_penjualan (id_barang);
CREATE INDEX idx_detail_penjualan_header ON detail_penjualan (id_penjualan);

-- ============================================================
-- PERGERAKAN STOK (kartu stok, append-only)
-- ============================================================
CREATE TABLE pergerakan_stok (
  id_pergerakan_stok  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_barang           BIGINT NOT NULL REFERENCES barang(id_barang) ON DELETE RESTRICT,
  tanggal_pergerakan  TIMESTAMPTZ NOT NULL DEFAULT now(),
  jenis_pergerakan    VARCHAR(40) NOT NULL,
  referensi_id        BIGINT,
  jumlah              NUMERIC(18,6) NOT NULL,
  id_satuan           BIGINT NOT NULL REFERENCES satuan(id_satuan) ON DELETE RESTRICT,
  jumlah_satuan_dasar NUMERIC(18,6) NOT NULL,
  harga_perolehan     NUMERIC(18,2) NOT NULL DEFAULT 0,
  nilai_persediaan    NUMERIC(18,2) NOT NULL DEFAULT 0,
  arah_stok           SMALLINT NOT NULL CHECK (arah_stok IN (-1, 1)),
  id_pengguna         BIGINT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT,
  catatan             TEXT
);
CREATE INDEX idx_pergerakan_barang_waktu
  ON pergerakan_stok (id_barang, tanggal_pergerakan, id_pergerakan_stok);
CREATE INDEX idx_pergerakan_referensi ON pergerakan_stok (jenis_pergerakan, referensi_id);

-- ============================================================
-- BIAYA OPERASIONAL
-- ============================================================
CREATE TABLE biaya_operasional (
  id_biaya       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tanggal_biaya  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kategori_biaya VARCHAR(80) NOT NULL,
  keterangan     TEXT,
  jumlah         NUMERIC(18,2) NOT NULL CHECK (jumlah > 0),
  id_pengguna    BIGINT NOT NULL REFERENCES pengguna(id_pengguna) ON DELETE RESTRICT
);
CREATE INDEX idx_biaya_tanggal ON biaya_operasional (tanggal_biaya DESC);

-- ============================================================
-- PENGATURAN
-- ============================================================
CREATE TABLE pengaturan (
  kunci VARCHAR(80) PRIMARY KEY,
  nilai TEXT NOT NULL
);
