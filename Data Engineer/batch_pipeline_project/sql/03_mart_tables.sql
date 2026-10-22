-- =============================================================================
-- 03_mart_tables.sql
-- Layer mart: tabel ringkasan siap pakai untuk analis/dashboard.
-- Definisi metrik ada di specs/design.md §3.3.
-- Revenue hanya dari order dengan status NOT IN ('canceled', 'unavailable').
-- =============================================================================

CREATE TABLE IF NOT EXISTS mart.daily_sales (
    sales_date           DATE PRIMARY KEY,
    total_orders         INTEGER        NOT NULL,
    total_items          INTEGER        NOT NULL,
    item_revenue_brl     NUMERIC(14, 2) NOT NULL,   -- SUM(price)
    freight_revenue_brl  NUMERIC(14, 2) NOT NULL,   -- SUM(freight_value)
    total_revenue_brl    NUMERIC(14, 2) NOT NULL,   -- SUM(price + freight_value)
    total_revenue_usd    NUMERIC(14, 2),            -- total_revenue_brl × kurs hari itu
    avg_order_value_brl  NUMERIC(12, 2) NOT NULL,   -- total_revenue_brl / total_orders
    refreshed_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);
COMMENT ON TABLE mart.daily_sales IS 'Penjualan harian berdasarkan tanggal pembelian.';

CREATE TABLE IF NOT EXISTS mart.monthly_category_sales (
    sales_month            DATE           NOT NULL,   -- tanggal 1 setiap bulan
    category_name_english  VARCHAR(100)   NOT NULL,
    total_orders           INTEGER        NOT NULL,
    total_items            INTEGER        NOT NULL,
    total_revenue_brl      NUMERIC(14, 2) NOT NULL,
    total_revenue_usd      NUMERIC(14, 2),
    avg_item_price_brl     NUMERIC(12, 2) NOT NULL,
    refreshed_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
    PRIMARY KEY (sales_month, category_name_english)
);
COMMENT ON TABLE mart.monthly_category_sales IS 'Penjualan bulanan per kategori produk (nama Inggris).';

CREATE TABLE IF NOT EXISTS mart.seller_performance (
    seller_id           VARCHAR(32) PRIMARY KEY,
    seller_state        CHAR(2),
    total_orders        INTEGER        NOT NULL,
    total_items         INTEGER        NOT NULL,
    total_revenue_brl   NUMERIC(14, 2) NOT NULL,
    avg_review_score    NUMERIC(3, 2),             -- NULL jika belum ada review
    avg_delivery_days   NUMERIC(6, 2),             -- NULL jika belum ada order terkirim
    late_delivery_rate  NUMERIC(5, 4),             -- 0.0000 – 1.0000
    refreshed_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);
COMMENT ON TABLE mart.seller_performance IS 'Volume, revenue, rating, dan ketepatan pengiriman per seller.';

CREATE TABLE IF NOT EXISTS mart.state_delivery_summary (
    customer_state      CHAR(2) PRIMARY KEY,
    total_customers     INTEGER        NOT NULL,   -- COUNT DISTINCT customer_unique_id
    total_orders        INTEGER        NOT NULL,
    total_revenue_brl   NUMERIC(14, 2) NOT NULL,
    avg_delivery_days   NUMERIC(6, 2),
    late_delivery_rate  NUMERIC(5, 4),
    avg_review_score    NUMERIC(3, 2),
    refreshed_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);
COMMENT ON TABLE mart.state_delivery_summary IS 'Performa pengiriman & kepuasan per negara bagian customer.';
