"""Data quality check untuk layer clean (Req 8.13) dan mart (Req 10.6, 10.7).

Dijalankan SETELAH transform dan SEBELUM load. Modul ini sengaja tidak memakai fungsi apa pun
dari transform.py: pemeriksa harus independen dari yang diperiksa, agar bug di transform
tidak ikut "meluluskan" dirinya sendiri.

Isinya mencerminkan constraint DDL (sql/02_clean_tables.sql), ditambah aturan lintas tabel
yang tidak bisa ditulis sebagai CHECK di SQL (contoh: review tidak boleh lebih awal dari order).
"""

import logging
from collections import Counter

import pandas as pd

from config import (
    BRAZIL_BOUNDS,
    BRAZIL_STATES,
    CLEAN_PRIMARY_KEYS,
    MART_PRIMARY_KEYS,
    MAX_SHIPPING_LIMIT_DAYS,
    NON_REVENUE_STATUSES,
    ORDER_STATUSES,
    PAYMENT_TYPES,
)

logger = logging.getLogger(__name__)

# Kolom NOT NULL selain primary key (sesuai DDL)
REQUIRED_COLUMNS = {
    "category_translation": ["category_name_english"],
    "geolocation": ["lat", "lng"],
    "customers": ["customer_unique_id", "zip_code_prefix"],
    "sellers": ["zip_code_prefix"],
    "products": ["category_name", "category_name_english"],
    "exchange_rates": ["brl_to_usd", "is_filled"],
    "orders": ["customer_id", "order_status", "purchase_at", "estimated_delivery_date", "purchase_date"],
    "order_items": ["product_id", "seller_id", "price", "freight_value", "total_item_value"],
    "order_payments": ["payment_type", "payment_installments", "payment_value"],
    "order_reviews": ["review_score", "creation_date", "has_comment"],
}

# (tabel anak, kolom, tabel induk, kolom induk)
FOREIGN_KEYS = [
    ("products", "category_name", "category_translation", "category_name"),
    ("orders", "customer_id", "customers", "customer_id"),
    ("order_items", "order_id", "orders", "order_id"),
    ("order_items", "product_id", "products", "product_id"),
    ("order_items", "seller_id", "sellers", "seller_id"),
    ("order_payments", "order_id", "orders", "order_id"),
    ("order_reviews", "order_id", "orders", "order_id"),
]

# ID Olist selalu 32 karakter heksadesimal
ID_COLUMNS = {
    "customers": ["customer_id", "customer_unique_id"],
    "sellers": ["seller_id"],
    "products": ["product_id"],
    "orders": ["order_id", "customer_id"],
    "order_items": ["order_id", "product_id", "seller_id"],
    "order_payments": ["order_id"],
    "order_reviews": ["review_id", "order_id"],
}


class DataQualityError(Exception):
    """Ada data clean yang melanggar aturan. Pipeline berhenti sebelum load."""


def _violations(mask: pd.Series) -> int:
    """True = melanggar. NA dianggap lolos, sama seperti CHECK di SQL yang meloloskan NULL."""
    return int(mask.fillna(False).astype(bool).sum())


def _messy_text(s: pd.Series) -> pd.Series:
    return s.notna() & ((s != s.str.strip()) | s.str.contains(r"\s{2,}|[\r\n\t]", na=False) | (s == ""))


def validate_clean(clean: dict[str, pd.DataFrame]) -> None:
    checks: list[tuple[str, str, int]] = []

    def check(table: str, rule: str, mask: pd.Series) -> None:
        checks.append((table, rule, _violations(mask)))

    c = clean
    orders, items, reviews = c["orders"], c["order_items"], c["order_reviews"]
    # Lookup dibuat dari baris unik: pemeriksa tidak boleh crash justru saat PK duplikat,
    # karena duplikat itu sendiri sudah dilaporkan oleh check PK di bawah.
    order_lookup = orders.drop_duplicates("order_id").set_index("order_id")
    purchase_at, purchase_date = order_lookup["purchase_at"], order_lookup["purchase_date"]

    # ---------- struktur: PK, NOT NULL, format ID, FK -------------------------
    for table, key in CLEAN_PRIMARY_KEYS.items():
        check(table, f"PK {key} unik", c[table].duplicated(subset=key))
        check(table, f"PK {key} tidak NULL", c[table][key].isna().any(axis=1))
    for table, columns in REQUIRED_COLUMNS.items():
        for column in columns:
            check(table, f"{column} tidak NULL", c[table][column].isna())
    for table, columns in ID_COLUMNS.items():
        for column in columns:
            check(table, f"{column} = 32 karakter hex", ~c[table][column].str.fullmatch(r"[0-9a-f]{32}", na=False))
    for child, column, parent, parent_column in FOREIGN_KEYS:
        check(child, f"FK {column} → {parent}.{parent_column}", ~c[child][column].isin(c[parent][parent_column]))

    # ---------- lokasi: zip, state, city, koordinat ---------------------------
    for table in ["geolocation", "customers", "sellers"]:
        df = c[table]
        check(table, "zip_code_prefix 5 digit", ~df["zip_code_prefix"].str.fullmatch(r"\d{5}", na=False))
        check(table, "state kode UF valid", df["state"].notna() & ~df["state"].isin(BRAZIL_STATES))
        city = df["city"]
        check(table, "city hanya huruf kecil tanpa aksen", city.notna() & ~city.str.fullmatch(r"[a-z0-9' \-.]+"))
        check(table, "city tanpa spasi berlebih", _messy_text(city))
        check(table, "city bukan angka / kode UF", city.str.fullmatch(r"\d+") | (city.str.len() <= 2))
    geo, b = c["geolocation"], BRAZIL_BOUNDS
    check("geolocation", "koordinat di dalam Brasil",
          ~(geo["lat"].between(b["lat_min"], b["lat_max"]) & geo["lng"].between(b["lng_min"], b["lng_max"])))

    # ---------- products ------------------------------------------------------
    p = c["products"]
    translation = c["category_translation"].drop_duplicates("category_name").set_index("category_name")
    english = p["category_name"].map(translation["category_name_english"])
    check("products", "category_name_english = tabel terjemahan", p["category_name_english"] != english)
    for column in ["weight_g", "length_cm", "height_cm", "width_cm"]:
        check("products", f"{column} > 0", p[column] <= 0)
    for column in ["name_length", "description_length", "photos_qty"]:
        check("products", f"{column} >= 0", p[column] < 0)
    check("products", "volume_cm3 = length × height × width",
          p["volume_cm3"] != p["length_cm"] * p["height_cm"] * p["width_cm"])

    # ---------- exchange rates ------------------------------------------------
    fx = c["exchange_rates"].sort_values("rate_date")
    check("exchange_rates", "brl_to_usd > 0", fx["brl_to_usd"] <= 0)
    check("exchange_rates", "tanggal kalender tanpa lubang", fx["rate_date"].diff().dt.days.fillna(1) != 1)
    check("exchange_rates", "setiap purchase_date order punya kurs", ~orders["purchase_date"].isin(fx["rate_date"]))

    # ---------- orders --------------------------------------------------------
    o = orders
    check("orders", "order_status dikenal", ~o["order_status"].isin(ORDER_STATUSES))
    check("orders", "approved_at >= purchase_at", o["approved_at"] < o["purchase_at"])
    check("orders", "delivered_customer_at >= purchase_at", o["delivered_customer_at"] < o["purchase_at"])
    check("orders", "delivered_carrier_at >= purchase_at", o["delivered_carrier_at"] < o["purchase_at"])
    check("orders", "delivered_carrier_at >= approved_at", o["delivered_carrier_at"] < o["approved_at"])
    check("orders", "delivered_carrier_at <= delivered_customer_at",
          o["delivered_carrier_at"] > o["delivered_customer_at"])
    check("orders", "estimated_delivery_date >= purchase_date", o["estimated_delivery_date"] < o["purchase_date"])
    check("orders", "purchase_date = tanggal dari purchase_at", o["purchase_date"] != o["purchase_at"].dt.normalize())
    check("orders", "delivery_days >= 0", o["delivery_days"] < 0)
    check("orders", "is_late = (delivery_delay_days > 0)", o["is_late"] != (o["delivery_delay_days"] > 0))
    check("orders", "is_late NULL ⇔ belum diterima", o["is_late"].isna() != o["delivered_customer_at"].isna())
    check("orders", "order penjualan punya minimal 1 item",
          ~o["order_status"].isin(NON_REVENUE_STATUSES) & ~o["order_id"].isin(items["order_id"]))

    # ---------- order items ---------------------------------------------------
    check("order_items", "order_item_id >= 1", items["order_item_id"] < 1)
    check("order_items", "price > 0", items["price"] <= 0)
    check("order_items", "freight_value >= 0", items["freight_value"] < 0)
    check("order_items", "total_item_value = price + freight_value",
          (items["total_item_value"] - (items["price"] + items["freight_value"])).abs() > 0.005)
    item_purchase = items["order_id"].map(purchase_at)
    check("order_items", f"shipping_limit_at dalam [purchase, +{MAX_SHIPPING_LIMIT_DAYS} hari]",
          (items["shipping_limit_at"] < item_purchase)
          | (items["shipping_limit_at"] > item_purchase + pd.Timedelta(days=MAX_SHIPPING_LIMIT_DAYS)))

    # ---------- order payments ------------------------------------------------
    pay = c["order_payments"]
    check("order_payments", "payment_sequential >= 1", pay["payment_sequential"] < 1)
    check("order_payments", "payment_installments >= 1", pay["payment_installments"] < 1)
    check("order_payments", "payment_value > 0", pay["payment_value"] <= 0)
    check("order_payments", "payment_type dikenal", ~pay["payment_type"].isin(PAYMENT_TYPES))

    # ---------- order reviews -------------------------------------------------
    r = reviews
    check("order_reviews", "review_score 1–5", ~r["review_score"].between(1, 5))
    check("order_reviews", "creation_date >= purchase_date order", r["creation_date"] < r["order_id"].map(purchase_date))
    check("order_reviews", "answer_at >= creation_date", r["answer_at"] < r["creation_date"])
    check("order_reviews", "response_hours >= 0", r["response_hours"] < 0)
    for column in ["comment_title", "comment_message"]:
        check("order_reviews", f"{column} rapi (tanpa spasi berlebih/kosong)", _messy_text(r[column]))
    check("order_reviews", "has_comment = ada title/message",
          r["has_comment"] != (r["comment_title"].notna() | r["comment_message"].notna()))

    _report(checks)


def validate_summaries(mart: dict[str, pd.DataFrame], clean: dict[str, pd.DataFrame]) -> None:
    """Quality check & rekonsiliasi tabel mart (Req 10.6, 10.7).

    Angka pembanding dihitung ulang langsung dari tabel clean di sini, tidak memakai summary.py.
    """
    checks: list[tuple[str, str, int]] = []

    def check(table: str, rule: str, mask: pd.Series) -> None:
        checks.append((table, rule, _violations(mask)))

    def reconcile(table: str, rule: str, actual: float, expected: float, tolerance: float) -> None:
        # Hasil dari jumlah nilai yang sudah dibulatkan per baris bisa beda sedikit dari total sebenarnya
        checks.append((table, f"{rule} ({actual:,.2f} vs {expected:,.2f})", int(abs(actual - expected) > tolerance)))

    m = mart
    for table, key in MART_PRIMARY_KEYS.items():
        check(table, f"PK {key} unik", m[table].duplicated(subset=key))
        check(table, f"PK {key} tidak NULL", m[table][key].isna().any(axis=1))

    # ---------- domain nilai --------------------------------------------------
    for table, df in m.items():
        for column in df.columns:
            if column.startswith("total_") or column.endswith("_brl") or column.endswith("_usd"):
                check(table, f"{column} >= 0", df[column] < 0)
            if column == "total_orders":
                check(table, "total_orders >= 1", df[column] < 1)
            if column == "late_delivery_rate":
                check(table, "late_delivery_rate 0–1", ~df[column].between(0, 1) & df[column].notna())
            if column == "avg_review_score":
                check(table, "avg_review_score 1–5", ~df[column].between(1, 5) & df[column].notna())
            if column == "avg_delivery_days":
                check(table, "avg_delivery_days >= 0", df[column] < 0)
    d = m["daily_sales"]
    check("daily_sales", "total = item + freight",
          (d["total_revenue_brl"] - d["item_revenue_brl"] - d["freight_revenue_brl"]).abs() > 0.011)
    check("daily_sales", "avg_order_value = total / orders",
          (d["avg_order_value_brl"] - d["total_revenue_brl"] / d["total_orders"]).abs() > 0.006)
    check("daily_sales", "total_items >= total_orders", d["total_items"] < d["total_orders"])
    check("seller_performance", "seller_state tidak NULL", m["seller_performance"]["seller_state"].isna())

    # ---------- rekonsiliasi dengan layer clean -------------------------------
    orders = clean["orders"]
    sales = orders[~orders["order_status"].isin(NON_REVENUE_STATUSES)]
    sale_items = clean["order_items"].merge(sales[["order_id", "purchase_date", "customer_id"]], on="order_id")
    expected_orders = float(len(sales))

    # Revenue PER BARIS, bukan hanya total: rekonsiliasi total memakai toleransi pembulatan
    # 0,005 × jumlah baris (≈ 6 BRL untuk 1.282 baris), sehingga selisih kecil di satu baris lolos.
    category = sale_items["product_id"].map(clean["products"].set_index("product_id")["category_name_english"])
    state = sale_items["customer_id"].map(clean["customers"].set_index("customer_id")["state"])
    revenue = sale_items["total_item_value"]
    expected_revenue = {
        "daily_sales": revenue.groupby(sale_items["purchase_date"].rename("sales_date")).sum(),
        "monthly_category_sales": revenue.groupby([
            sale_items["purchase_date"].dt.to_period("M").dt.to_timestamp().rename("sales_month"),
            category.rename("category_name_english")]).sum(),
        "seller_performance": revenue.groupby(sale_items["seller_id"]).sum(),
        "state_delivery_summary": revenue.groupby(state.rename("customer_state")).sum(),
    }
    for table, expected in expected_revenue.items():
        key = MART_PRIMARY_KEYS[table]
        # merge (bukan concat/reindex) agar tidak crash jika mart punya key dobel; dobel dilaporkan check PK
        both = m[table][key + ["total_revenue_brl"]].merge(
            expected.rename("clean").reset_index(), on=key, how="outer")
        check(table, "revenue per baris = clean (selisih ≤ 0,006)",
              both["total_revenue_brl"].isna() | both["clean"].isna()
              | ((both["total_revenue_brl"] - both["clean"]).abs() > 0.006))
    for table in ["daily_sales", "state_delivery_summary"]:
        reconcile(table, "total order = order penjualan clean", float(m[table]["total_orders"].sum()),
                  expected_orders, 0)
    reconcile("monthly_category_sales", "total item = item penjualan clean",
              float(m["monthly_category_sales"]["total_items"].sum()), float(len(sale_items)), 0)
    reconcile("monthly_category_sales", "total revenue USD = daily_sales",
              float(m["monthly_category_sales"]["total_revenue_usd"].sum()),
              float(d["total_revenue_usd"].sum()), 0.005 * (len(d) + len(m["monthly_category_sales"])))
    reconcile("seller_performance", "jumlah seller = seller yang punya penjualan",
              float(len(m["seller_performance"])), float(sale_items["seller_id"].nunique()), 0)
    reconcile("total", "revenue seluruh mart = clean",
              float(m["daily_sales"]["total_revenue_brl"].sum()), float(revenue.sum()), 0.005 * len(d) + 0.01)

    _report(checks)


def _report(checks: list[tuple[str, str, int]]) -> None:
    failed = [(t, rule, n) for t, rule, n in checks if n > 0]
    per_table = Counter(t for t, _, _ in checks)
    for table, total in per_table.items():
        n_failed = sum(1 for t, _, _ in failed if t == table)
        logger.info("quality | %-24s : %2d/%2d check lolos", table, total - n_failed, total)
    for table, rule, n in failed:
        logger.error("quality | GAGAL %s: %s (%d pelanggaran)", table, rule, n)
    if failed:
        raise DataQualityError(f"{len(failed)} dari {len(checks)} data quality check gagal, lihat log di atas")
    logger.info("quality | SEMUA %d check lolos", len(checks))
