"""Konfigurasi pipeline: path, sumber data, API, dan aturan validasi.

Semua "angka ajaib" dikumpulkan di sini, bukan tersebar di kode, sehingga mudah
dicari dan diubah tanpa menyentuh logika pipeline.
"""

import logging
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ENV_FILE = BASE_DIR / ".env"
DB_CONNECT_TIMEOUT_SECONDS = 10

# --- Sumber CSV --------------------------------------------------------------
# key = nama tabel di schema raw; "columns" = header yang WAJIB ada (urutan persis).
# Jika Kaggle mengubah struktur file, pipeline akan berhenti di extract (Req 1.4),
# bukan gagal diam-diam di tengah transform.
CSV_SOURCES = {
    "customers": {
        "file": "olist_customers_dataset.csv",
        "columns": ["customer_id", "customer_unique_id", "customer_zip_code_prefix",
                    "customer_city", "customer_state"],
    },
    "geolocation": {
        "file": "olist_geolocation_dataset.csv",
        "columns": ["geolocation_zip_code_prefix", "geolocation_lat", "geolocation_lng",
                    "geolocation_city", "geolocation_state"],
    },
    "orders": {
        "file": "olist_orders_dataset.csv",
        "columns": ["order_id", "customer_id", "order_status", "order_purchase_timestamp",
                    "order_approved_at", "order_delivered_carrier_date",
                    "order_delivered_customer_date", "order_estimated_delivery_date"],
    },
    "order_items": {
        "file": "olist_order_items_dataset.csv",
        "columns": ["order_id", "order_item_id", "product_id", "seller_id",
                    "shipping_limit_date", "price", "freight_value"],
    },
    "order_payments": {
        "file": "olist_order_payments_dataset.csv",
        "columns": ["order_id", "payment_sequential", "payment_type",
                    "payment_installments", "payment_value"],
    },
    "order_reviews": {
        "file": "olist_order_reviews_dataset.csv",
        "columns": ["review_id", "order_id", "review_score", "review_comment_title",
                    "review_comment_message", "review_creation_date",
                    "review_answer_timestamp"],
    },
    "products": {
        "file": "olist_products_dataset.csv",
        "columns": ["product_id", "product_category_name", "product_name_lenght",
                    "product_description_lenght", "product_photos_qty", "product_weight_g",
                    "product_length_cm", "product_height_cm", "product_width_cm"],
    },
    "sellers": {
        "file": "olist_sellers_dataset.csv",
        "columns": ["seller_id", "seller_zip_code_prefix", "seller_city", "seller_state"],
    },
    "category_translation": {
        "file": "product_category_name_translation.csv",
        "columns": ["product_category_name", "product_category_name_english"],
    },
}

# --- API kurs (Frankfurter, gratis tanpa API key) -----------------------------
EXCHANGE_RATE_API_URL = "https://api.frankfurter.dev/v1"
BASE_CURRENCY = "BRL"
QUOTE_CURRENCY = "USD"
API_TIMEOUT_SECONDS = 30
API_MAX_RETRIES = 3            # 1 percobaan awal + 3 retry
API_BACKOFF_SECONDS = 2        # jeda retry: 2, 4, 8 detik
# Tanggal order pertama jatuh di hari Minggu (tidak ada kurs). Ambil kurs mulai
# beberapa hari lebih awal agar forward fill di transform punya nilai awal.
EXCHANGE_RATE_LOOKBACK_DAYS = 7

# --- Aturan validasi (dipakai di transform & quality check) ------------------
BRAZIL_BOUNDS = {"lat_min": -33.75, "lat_max": 5.27, "lng_min": -73.99, "lng_max": -34.79}
BRAZIL_STATES = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}
ORDER_STATUSES = {"created", "approved", "invoiced", "processing", "shipped", "delivered",
                  "canceled", "unavailable"}
NON_REVENUE_STATUSES = {"canceled", "unavailable"}   # tidak dihitung sebagai penjualan
PAYMENT_TYPES = {"credit_card", "boleto", "voucher", "debit_card"}
MAX_SHIPPING_LIMIT_DAYS = 90   # batas kirim > 90 hari setelah beli dianggap tidak valid (p99.9 = 36 hari)

UNKNOWN_CATEGORY = "unknown"
# Kategori produk yang tidak ada di file terjemahan Kaggle
CATEGORY_TRANSLATION_OVERRIDES = {
    "pc_gamer": "pc_gamer",
    "portateis_cozinha_e_preparadores_de_alimentos": "portable_kitchen_food_processors",
    UNKNOWN_CATEGORY: UNKNOWN_CATEGORY,
}
# Singkatan kota yang ditemukan saat profiling (sudah dinormalisasi)
CITY_ABBREVIATIONS = {"sbc": "sao bernardo do campo"}

# Primary key setiap tabel clean: dipakai untuk deduplikasi & quality check
CLEAN_PRIMARY_KEYS = {
    "category_translation": ["category_name"],
    "geolocation": ["zip_code_prefix"],
    "customers": ["customer_id"],
    "sellers": ["seller_id"],
    "products": ["product_id"],
    "exchange_rates": ["rate_date"],
    "orders": ["order_id"],
    "order_items": ["order_id", "order_item_id"],
    "order_payments": ["order_id", "payment_sequential"],
    "order_reviews": ["review_id", "order_id"],
}
# Urutan dict di atas = urutan load (induk → anak, sesuai foreign key)
CLEAN_LOAD_ORDER = list(CLEAN_PRIMARY_KEYS)

MART_PRIMARY_KEYS = {
    "daily_sales": ["sales_date"],
    "monthly_category_sales": ["sales_month", "category_name_english"],
    "seller_performance": ["seller_id"],
    "state_delivery_summary": ["customer_state"],
}
MART_LOAD_ORDER = list(MART_PRIMARY_KEYS)   # tabel mart tidak saling ber-FK, urutan bebas

# --- Logging -----------------------------------------------------------------
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(level=level, format=LOG_FORMAT, datefmt=LOG_DATE_FORMAT)
