-- =============================================================================
-- 04_verify.sql
-- Query verifikasi data quality SETELAH pipeline dijalankan (Task 10.2).
-- Jalankan per bagian di DBMS. Setiap bagian menyebut hasil yang diharapkan.
--
-- PK, FK, dan CHECK sudah dijaga database (02_clean_tables.sql), jadi tidak diulang di sini.
-- Fokus file ini: aturan yang TIDAK BISA ditulis sebagai constraint (lintas tabel),
-- rekonsiliasi antar layer, dan perhitungan ulang mart dengan SQL murni.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Jumlah baris per layer
--    Diharapkan: raw orders 99.441 → clean 99.433; raw geolocation 1.000.163 → clean 19.010;
--    mart daily_sales 614, monthly_category_sales 1.282, seller_performance 3.053, state 27.
-- -----------------------------------------------------------------------------
SELECT 'raw' AS layer, 'orders' AS tabel, COUNT(*) AS baris FROM raw.orders
UNION ALL SELECT 'clean', 'orders', COUNT(*) FROM clean.orders
UNION ALL SELECT 'raw', 'order_items', COUNT(*) FROM raw.order_items
UNION ALL SELECT 'clean', 'order_items', COUNT(*) FROM clean.order_items
UNION ALL SELECT 'raw', 'order_payments', COUNT(*) FROM raw.order_payments
UNION ALL SELECT 'clean', 'order_payments', COUNT(*) FROM clean.order_payments
UNION ALL SELECT 'raw', 'order_reviews', COUNT(*) FROM raw.order_reviews
UNION ALL SELECT 'clean', 'order_reviews', COUNT(*) FROM clean.order_reviews
UNION ALL SELECT 'raw', 'geolocation', COUNT(*) FROM raw.geolocation
UNION ALL SELECT 'clean', 'geolocation', COUNT(*) FROM clean.geolocation
UNION ALL SELECT 'mart', 'daily_sales', COUNT(*) FROM mart.daily_sales
UNION ALL SELECT 'mart', 'monthly_category_sales', COUNT(*) FROM mart.monthly_category_sales
UNION ALL SELECT 'mart', 'seller_performance', COUNT(*) FROM mart.seller_performance
UNION ALL SELECT 'mart', 'state_delivery_summary', COUNT(*) FROM mart.state_delivery_summary
ORDER BY tabel, layer DESC;   -- tanpa ORDER BY, urutan hasil UNION ALL tidak dijamin


-- -----------------------------------------------------------------------------
-- 2. Aturan lintas tabel yang tidak bisa menjadi CHECK constraint
--    Diharapkan: SEMUA kolom pelanggaran = 0.
-- -----------------------------------------------------------------------------
SELECT
    -- Req 8.8: review tidak boleh dibuat sebelum order dibeli
    (SELECT COUNT(*) FROM clean.order_reviews r JOIN clean.orders o USING (order_id)
      WHERE r.creation_date < o.purchase_date)                                        AS review_sebelum_beli,
    -- Req 8.7: order penjualan wajib punya item
    (SELECT COUNT(*) FROM clean.orders o
      WHERE o.order_status NOT IN ('canceled', 'unavailable')
        AND NOT EXISTS (SELECT 1 FROM clean.order_items i WHERE i.order_id = o.order_id)) AS order_tanpa_item,
    -- Req 8.9: batas kirim maksimal 90 hari setelah beli
    (SELECT COUNT(*) FROM clean.order_items i JOIN clean.orders o USING (order_id)
      WHERE i.shipping_limit_at NOT BETWEEN o.purchase_at AND o.purchase_at + INTERVAL '90 days') AS batas_kirim_invalid,
    -- Req 5.6: setiap tanggal beli punya kurs
    (SELECT COUNT(*) FROM clean.orders o
      WHERE NOT EXISTS (SELECT 1 FROM clean.exchange_rates r WHERE r.rate_date = o.purchase_date)) AS order_tanpa_kurs,
    -- Req 5.6: kalender kurs tanpa lubang
    (SELECT (MAX(rate_date) - MIN(rate_date) + 1) - COUNT(*) FROM clean.exchange_rates) AS lubang_kalender_kurs,
    -- Req 6.4: nama kota seragam (huruf kecil tanpa aksen, tanpa spasi ganda)
    (SELECT COUNT(*) FROM (SELECT city FROM clean.customers UNION ALL SELECT city FROM clean.sellers
                           UNION ALL SELECT city FROM clean.geolocation) c
      WHERE city !~ '^[a-z0-9'' .-]+$' OR city LIKE '%  %')                         AS kota_tidak_standar,
    -- Req 6.6: komentar review rapi
    (SELECT COUNT(*) FROM clean.order_reviews
      WHERE comment_message <> btrim(comment_message) OR comment_message ~ '\s{2,}|[\r\n]'
         OR comment_message = '')                                                     AS komentar_tidak_rapi;


-- -----------------------------------------------------------------------------
-- 3. Rekonsiliasi revenue: clean vs setiap tabel mart (Req 10.6)
--    Diharapkan: semua kolom selisih_* = 0.00 (paling banyak beberapa sen karena pembulatan per baris).
-- -----------------------------------------------------------------------------
WITH clean_revenue AS (
    SELECT SUM(i.total_item_value) AS total
    FROM clean.order_items i JOIN clean.orders o USING (order_id)
    WHERE o.order_status NOT IN ('canceled', 'unavailable')
)
SELECT c.total AS revenue_clean,
       c.total - (SELECT SUM(total_revenue_brl) FROM mart.daily_sales)            AS selisih_daily,
       c.total - (SELECT SUM(total_revenue_brl) FROM mart.monthly_category_sales) AS selisih_category,
       c.total - (SELECT SUM(total_revenue_brl) FROM mart.seller_performance)     AS selisih_seller,
       c.total - (SELECT SUM(total_revenue_brl) FROM mart.state_delivery_summary) AS selisih_state
FROM clean_revenue c;


-- -----------------------------------------------------------------------------
-- 4. Hitung ulang mart dengan SQL murni, bandingkan dengan isi mart (implementasi ganda)
--    Mart dibangun dengan pandas (transform/summary.py). Jika dua implementasi yang ditulis
--    dengan cara berbeda menghasilkan angka yang sama, kecil kemungkinan keduanya salah dengan cara sama.
--    Diharapkan: 0 baris (tidak ada perbedaan) untuk keempat query di bawah.
-- -----------------------------------------------------------------------------

-- 4a. daily_sales
WITH sales AS (
    SELECT * FROM clean.orders WHERE order_status NOT IN ('canceled', 'unavailable')
), items AS (
    SELECT i.*, s.purchase_date, i.total_item_value * r.brl_to_usd AS usd
    FROM clean.order_items i JOIN sales s USING (order_id)
    JOIN clean.exchange_rates r ON r.rate_date = s.purchase_date
), expected AS (
    SELECT purchase_date AS sales_date, COUNT(DISTINCT order_id) AS total_orders, COUNT(*) AS total_items,
           ROUND(SUM(total_item_value), 2) AS total_revenue_brl, ROUND(SUM(usd), 2) AS total_revenue_usd
    FROM items GROUP BY purchase_date
)
SELECT e.*, m.total_orders AS mart_orders, m.total_revenue_brl AS mart_brl, m.total_revenue_usd AS mart_usd
FROM expected e FULL JOIN mart.daily_sales m USING (sales_date)
WHERE m.sales_date IS NULL OR e.sales_date IS NULL
   OR e.total_orders <> m.total_orders OR e.total_items <> m.total_items
   OR ABS(e.total_revenue_brl - m.total_revenue_brl) > 0.01
   OR ABS(e.total_revenue_usd - m.total_revenue_usd) > 0.01;

-- 4b. monthly_category_sales
WITH items AS (
    SELECT i.*, p.category_name_english, date_trunc('month', o.purchase_date)::date AS sales_month,
           i.total_item_value * r.brl_to_usd AS usd
    FROM clean.order_items i
    JOIN clean.orders o USING (order_id)
    JOIN clean.products p USING (product_id)
    JOIN clean.exchange_rates r ON r.rate_date = o.purchase_date
    WHERE o.order_status NOT IN ('canceled', 'unavailable')
), expected AS (
    SELECT sales_month, category_name_english, COUNT(DISTINCT order_id) AS total_orders, COUNT(*) AS total_items,
           ROUND(SUM(total_item_value), 2) AS total_revenue_brl, ROUND(SUM(usd), 2) AS total_revenue_usd,
           ROUND(AVG(price), 2) AS avg_item_price_brl
    FROM items GROUP BY sales_month, category_name_english
)
SELECT e.*, m.total_revenue_brl AS mart_brl
FROM expected e FULL JOIN mart.monthly_category_sales m USING (sales_month, category_name_english)
WHERE m.sales_month IS NULL OR e.sales_month IS NULL
   OR e.total_orders <> m.total_orders OR e.total_items <> m.total_items
   OR ABS(e.total_revenue_brl - m.total_revenue_brl) > 0.01
   OR ABS(e.total_revenue_usd - m.total_revenue_usd) > 0.01
   OR ABS(e.avg_item_price_brl - m.avg_item_price_brl) > 0.01;

-- 4c. seller_performance (skor review = review TERAKHIR per order; metrik kirim hanya order delivered)
WITH sales AS (
    SELECT * FROM clean.orders WHERE order_status NOT IN ('canceled', 'unavailable')
), latest_review AS (
    SELECT DISTINCT ON (order_id) order_id, review_score
    FROM clean.order_reviews
    ORDER BY order_id, answer_at DESC NULLS LAST, creation_date DESC, review_id DESC
), seller_orders AS (
    SELECT DISTINCT i.seller_id, s.order_id, lr.review_score,
           CASE WHEN s.order_status = 'delivered' AND s.delivered_customer_at IS NOT NULL THEN s.delivery_days END AS d_days,
           CASE WHEN s.order_status = 'delivered' AND s.delivered_customer_at IS NOT NULL THEN s.is_late::int END AS d_late
    FROM clean.order_items i JOIN sales s USING (order_id) LEFT JOIN latest_review lr USING (order_id)
), expected AS (
    SELECT seller_id,
           (SELECT ROUND(SUM(i.total_item_value), 2) FROM clean.order_items i JOIN sales s USING (order_id)
             WHERE i.seller_id = so.seller_id) AS total_revenue_brl,
           COUNT(*) AS total_orders, ROUND(AVG(review_score), 2) AS avg_review_score,
           ROUND(AVG(d_days), 2) AS avg_delivery_days, ROUND(AVG(d_late), 4) AS late_delivery_rate
    FROM seller_orders so GROUP BY seller_id
)
SELECT e.*, m.total_revenue_brl AS mart_brl, m.avg_review_score AS mart_review
FROM expected e FULL JOIN mart.seller_performance m USING (seller_id)
WHERE m.seller_id IS NULL OR e.seller_id IS NULL
   OR e.total_orders <> m.total_orders
   OR ABS(e.total_revenue_brl - m.total_revenue_brl) > 0.01
   OR ABS(e.avg_review_score - m.avg_review_score) > 0.01 OR (e.avg_review_score IS NULL) <> (m.avg_review_score IS NULL)
   OR ABS(e.avg_delivery_days - m.avg_delivery_days) > 0.01 OR (e.avg_delivery_days IS NULL) <> (m.avg_delivery_days IS NULL)
   OR ABS(e.late_delivery_rate - m.late_delivery_rate) > 0.0001;

-- 4d. state_delivery_summary
WITH sales AS (
    SELECT * FROM clean.orders WHERE order_status NOT IN ('canceled', 'unavailable')
), latest_review AS (
    SELECT DISTINCT ON (order_id) order_id, review_score
    FROM clean.order_reviews
    ORDER BY order_id, answer_at DESC NULLS LAST, creation_date DESC, review_id DESC
), facts AS (
    SELECT s.order_id, c.state, c.customer_unique_id, lr.review_score,
           (SELECT SUM(total_item_value) FROM clean.order_items i WHERE i.order_id = s.order_id) AS revenue,
           CASE WHEN s.order_status = 'delivered' AND s.delivered_customer_at IS NOT NULL THEN s.delivery_days END AS d_days,
           CASE WHEN s.order_status = 'delivered' AND s.delivered_customer_at IS NOT NULL THEN s.is_late::int END AS d_late
    FROM sales s JOIN clean.customers c USING (customer_id) LEFT JOIN latest_review lr USING (order_id)
), expected AS (
    SELECT state AS customer_state, COUNT(DISTINCT customer_unique_id) AS total_customers, COUNT(*) AS total_orders,
           ROUND(SUM(revenue), 2) AS total_revenue_brl, ROUND(AVG(d_days), 2) AS avg_delivery_days,
           ROUND(AVG(d_late), 4) AS late_delivery_rate, ROUND(AVG(review_score), 2) AS avg_review_score
    FROM facts GROUP BY state
)
SELECT e.*, m.total_revenue_brl AS mart_brl
FROM expected e FULL JOIN mart.state_delivery_summary m USING (customer_state)
WHERE m.customer_state IS NULL OR e.customer_state IS NULL
   OR e.total_customers <> m.total_customers OR e.total_orders <> m.total_orders
   OR ABS(e.total_revenue_brl - m.total_revenue_brl) > 0.01
   OR ABS(e.avg_delivery_days - m.avg_delivery_days) > 0.01
   OR ABS(e.late_delivery_rate - m.late_delivery_rate) > 0.0001
   OR ABS(e.avg_review_score - m.avg_review_score) > 0.01;
