-- =============================================================================
-- 02_clean_tables.sql
-- Layer clean: tipe data benar, primary key, foreign key, dan CHECK constraint.
-- CHECK constraint di sini adalah "jaring pengaman" kedua: aturan yang sama sudah
-- difilter di transform.py, tapi kalau ada bug, database yang akan menolaknya.
-- Urutan CREATE = urutan dependensi FK (induk dulu, baru anak).
-- =============================================================================

-- ---------- Dimensi / referensi ----------------------------------------------

CREATE TABLE IF NOT EXISTS clean.category_translation (
    category_name          VARCHAR(100) PRIMARY KEY,
    category_name_english  VARCHAR(100) NOT NULL
);
COMMENT ON TABLE clean.category_translation IS 'Terjemahan kategori produk PT→EN, termasuk kategori "unknown".';

CREATE TABLE IF NOT EXISTS clean.geolocation (
    zip_code_prefix  VARCHAR(5) PRIMARY KEY CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
    lat              DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -33.75 AND 5.27),
    lng              DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -73.99 AND -34.79),
    city             VARCHAR(100),
    state            CHAR(2)
);
COMMENT ON TABLE clean.geolocation IS 'Satu baris per zip code prefix (median lat/lng, kota terbanyak).';

CREATE TABLE IF NOT EXISTS clean.customers (
    customer_id         VARCHAR(32) PRIMARY KEY,
    customer_unique_id  VARCHAR(32) NOT NULL,
    zip_code_prefix     VARCHAR(5)  NOT NULL CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
    city                VARCHAR(100),
    state               CHAR(2)
);
COMMENT ON TABLE clean.customers IS 'customer_id unik per order; satu orang (customer_unique_id) bisa punya banyak customer_id.';

CREATE TABLE IF NOT EXISTS clean.sellers (
    seller_id        VARCHAR(32) PRIMARY KEY,
    zip_code_prefix  VARCHAR(5)  NOT NULL CHECK (zip_code_prefix ~ '^[0-9]{5}$'),
    city             VARCHAR(100),
    state            CHAR(2)
);

CREATE TABLE IF NOT EXISTS clean.products (
    product_id             VARCHAR(32)  PRIMARY KEY,
    category_name          VARCHAR(100) NOT NULL REFERENCES clean.category_translation (category_name),
    category_name_english  VARCHAR(100) NOT NULL,
    name_length            INTEGER CHECK (name_length >= 0),
    description_length     INTEGER CHECK (description_length >= 0),
    photos_qty             INTEGER CHECK (photos_qty >= 0),
    weight_g               INTEGER CHECK (weight_g > 0),       -- 0 gram mustahil → NULL di transform
    length_cm              INTEGER CHECK (length_cm >= 0),
    height_cm              INTEGER CHECK (height_cm >= 0),
    width_cm               INTEGER CHECK (width_cm >= 0),
    volume_cm3             INTEGER CHECK (volume_cm3 >= 0)   -- kalkulasi: length × height × width
);

CREATE TABLE IF NOT EXISTS clean.exchange_rates (
    rate_date   DATE PRIMARY KEY,
    brl_to_usd  NUMERIC(12, 6) NOT NULL CHECK (brl_to_usd > 0),
    is_filled   BOOLEAN NOT NULL DEFAULT FALSE   -- TRUE = hasil forward fill (akhir pekan/libur)
);

-- ---------- Fakta / transaksi ------------------------------------------------

CREATE TABLE IF NOT EXISTS clean.orders (
    order_id                 VARCHAR(32) PRIMARY KEY,
    customer_id              VARCHAR(32) NOT NULL REFERENCES clean.customers (customer_id),
    order_status             VARCHAR(20) NOT NULL CHECK (order_status IN (
                                 'created', 'approved', 'invoiced', 'processing',
                                 'shipped', 'delivered', 'canceled', 'unavailable')),
    purchase_at              TIMESTAMP NOT NULL,
    approved_at              TIMESTAMP,
    delivered_carrier_at     TIMESTAMP,
    delivered_customer_at    TIMESTAMP,
    estimated_delivery_date  DATE NOT NULL,
    -- kolom kalkulasi
    purchase_date            DATE NOT NULL,
    delivery_days            INTEGER,    -- NULL jika belum diterima customer
    delivery_delay_days      INTEGER,    -- positif = terlambat, negatif = lebih cepat dari estimasi
    is_late                  BOOLEAN,    -- NULL jika belum diterima customer
    -- urutan waktu: purchase ≤ approved ≤ carrier ≤ delivered (NULL selalu lolos CHECK)
    CONSTRAINT chk_orders_approved_after_purchase  CHECK (approved_at >= purchase_at),
    CONSTRAINT chk_orders_delivered_after_purchase CHECK (delivered_customer_at >= purchase_at),
    CONSTRAINT chk_orders_carrier_after_purchase   CHECK (delivered_carrier_at >= purchase_at),
    CONSTRAINT chk_orders_carrier_after_approved   CHECK (delivered_carrier_at >= approved_at),
    CONSTRAINT chk_orders_carrier_before_delivered CHECK (delivered_carrier_at <= delivered_customer_at)
);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id   ON clean.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_purchase_date ON clean.orders (purchase_date);

CREATE TABLE IF NOT EXISTS clean.order_items (
    order_id           VARCHAR(32) NOT NULL REFERENCES clean.orders (order_id),
    order_item_id      SMALLINT    NOT NULL CHECK (order_item_id >= 1),
    product_id         VARCHAR(32) NOT NULL REFERENCES clean.products (product_id),
    seller_id          VARCHAR(32) NOT NULL REFERENCES clean.sellers (seller_id),
    shipping_limit_at  TIMESTAMP,              -- NULL jika > 90 hari setelah pembelian (tidak masuk akal)
    price              NUMERIC(10, 2) NOT NULL CHECK (price > 0),
    freight_value      NUMERIC(10, 2) NOT NULL CHECK (freight_value >= 0),
    total_item_value   NUMERIC(10, 2) NOT NULL,   -- kalkulasi: price + freight_value
    PRIMARY KEY (order_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON clean.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id  ON clean.order_items (seller_id);

CREATE TABLE IF NOT EXISTS clean.order_payments (
    order_id              VARCHAR(32) NOT NULL REFERENCES clean.orders (order_id),
    payment_sequential    SMALLINT    NOT NULL CHECK (payment_sequential >= 1),
    payment_type          VARCHAR(20) NOT NULL CHECK (payment_type IN ('credit_card', 'boleto', 'voucher', 'debit_card')),
    payment_installments  SMALLINT    NOT NULL CHECK (payment_installments >= 1),
    payment_value         NUMERIC(10, 2) NOT NULL CHECK (payment_value > 0),
    PRIMARY KEY (order_id, payment_sequential)
);

-- review_id TIDAK unik di sumber (814 duplikat) → PK gabungan (review_id, order_id)
CREATE TABLE IF NOT EXISTS clean.order_reviews (
    review_id        VARCHAR(32) NOT NULL,
    order_id         VARCHAR(32) NOT NULL REFERENCES clean.orders (order_id),
    review_score     SMALLINT    NOT NULL CHECK (review_score BETWEEN 1 AND 5),
    comment_title    TEXT,
    comment_message  TEXT,
    creation_date    DATE        NOT NULL,
    answer_at        TIMESTAMP,
    -- kolom kalkulasi
    has_comment      BOOLEAN     NOT NULL,
    response_hours   NUMERIC(10, 2),
    PRIMARY KEY (review_id, order_id),
    CONSTRAINT chk_reviews_answer_after_creation CHECK (answer_at >= creation_date)
);
