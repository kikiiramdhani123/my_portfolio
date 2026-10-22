"""Transform: mengubah DataFrame raw (semua teks) menjadi tabel clean yang siap di-load.

Setiap fungsi transform_<tabel>() adalah pure function: DataFrame masuk → DataFrame keluar,
tanpa akses database, sehingga mudah di-unit test (NFR-3).

Prinsip penanganan anomali (requirements.md, Requirement 8):
  koreksi jika nilai benar bisa dipastikan → NULL jika hanya satu kolom yang salah
  → buang baris jika kontradiktif → pertahankan outlier yang masih mungkin terjadi.
Setiap aturan mencatat jumlah baris terdampak ke log (Req 8.12).
"""

import logging
import re
import unicodedata

import pandas as pd

from config import (
    BRAZIL_BOUNDS,
    BRAZIL_STATES,
    CATEGORY_TRANSLATION_OVERRIDES,
    CITY_ABBREVIATIONS,
    MAX_SHIPPING_LIMIT_DAYS,
    NON_REVENUE_STATUSES,
    ORDER_STATUSES,
    PAYMENT_TYPES,
    UNKNOWN_CATEGORY,
)
from transform.quality import validate_clean

logger = logging.getLogger(__name__)

DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"


# =============================================================================
# Helper: setiap helper mencatat jumlah baris terdampak
# =============================================================================

def _log(table: str, action: str, rule: str, count: int) -> None:
    logger.info("%-20s | %-7s | %-62s : %8s", table, action, rule, f"{count:,}")


def _as_mask(mask: pd.Series) -> pd.Series:
    """Mask boolean tanpa NA. NA dianggap False, sama seperti CHECK di SQL yang meloloskan NULL."""
    return mask.fillna(False).astype(bool)


def _drop(df: pd.DataFrame, mask: pd.Series, table: str, rule: str) -> pd.DataFrame:
    mask = _as_mask(mask)
    _log(table, "BUANG", rule, int(mask.sum()))
    return df.loc[~mask].reset_index(drop=True)


def _set_null(df: pd.DataFrame, mask: pd.Series, column: str, table: str, rule: str) -> pd.DataFrame:
    mask = _as_mask(mask)
    _log(table, "NULL", rule, int(mask.sum()))
    return df.assign(**{column: df[column].mask(mask)})


def _deduplicate(df: pd.DataFrame, key: list[str], table: str) -> pd.DataFrame:
    """Req 4.1: buang duplikat penuh. Req 4.2: satu baris per primary key (yang pertama)."""
    full = df.duplicated()
    df = _drop(df, full, table, "duplikat penuh (semua kolom sama)")
    return _drop(df, df.duplicated(subset=key), table, f"duplikat primary key {key}")


def _parse_datetime(series: pd.Series, table: str, column: str) -> pd.Series:
    """Req 6.1 & 6.3: teks → datetime; nilai yang tidak bisa di-parse menjadi NaT dan dicatat."""
    parsed = pd.to_datetime(series, format=DATETIME_FORMAT, errors="coerce")
    failed = int((parsed.isna() & series.notna()).sum())
    if failed:
        logger.warning("%s.%s: %d nilai tanggal tidak bisa di-parse → NULL", table, column, failed)
    return parsed


def _parse_number(series: pd.Series, table: str, column: str) -> pd.Series:
    parsed = pd.to_numeric(series, errors="coerce")
    failed = int((parsed.isna() & series.notna()).sum())
    if failed:
        logger.warning("%s.%s: %d nilai angka tidak bisa di-parse → NULL", table, column, failed)
    return parsed


def _clean_text(series: pd.Series) -> pd.Series:
    """Req 6.6 & 5.5: rapikan spasi/baris baru; teks kosong atau hanya spasi → NULL."""
    cleaned = series.str.replace(r"\s+", " ", regex=True).str.strip()
    return cleaned.where(cleaned != "")


def _mode_by_key(df: pd.DataFrame, key: str, column: str) -> pd.Series:
    """Nilai terbanyak per key. Jika seri, ambil yang pertama secara abjad (hasil deterministik)."""
    counts = df.groupby([key, column]).size().reset_index(name="n")
    counts = counts.sort_values([key, "n", column], ascending=[True, False, True])
    return counts.drop_duplicates(key).set_index(key)[column]


# =============================================================================
# Normalisasi nama kota (Req 6.4, 6.5)
# =============================================================================

_CITY_DISALLOWED_CHARS = re.compile(r"[^a-z0-9' \-.]")


def _normalize_city_value(value: str) -> str | None:
    text = value.lower()
    for apostrophe in "´`’‘":                         # "d´oeste" → "d'oeste"
        text = text.replace(apostrophe, "'")
    text = unicodedata.normalize("NFKD", text)        # "ã" → "a" + tanda tilde terpisah...
    text = "".join(ch for ch in text if not unicodedata.combining(ch))   # ...lalu tandanya dibuang
    text = re.sub(r"\(.*?\)", " ", text)              # "arraial d'ajuda (porto seguro)" → "arraial d'ajuda"
    text = re.split(r"[/\\,]", text)[0]               # "maua/sao paulo", "novo hamburgo, rs" → bagian pertama
    text = _CITY_DISALLOWED_CHARS.sub("", text)       # karakter rusak: "sa£o paulo" → "sao paulo"
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def normalize_city(cities: pd.Series) -> pd.Series:
    # Dihitung per nilai unik: geolocation punya 1 juta baris tapi hanya ±8 ribu nama kota
    mapping = {value: _normalize_city_value(value) for value in cities.dropna().unique()}
    return cities.map(mapping)


def _resolve_city(raw_city: pd.Series, zip_code: pd.Series, geo_city_by_zip: pd.Series,
                  table: str) -> pd.Series:
    """Normalisasi kota; kota invalid diganti singkatan dikenal atau kota geolocation dari zip."""
    city = normalize_city(raw_city).replace(CITY_ABBREVIATIONS)
    changed = city.fillna("") != raw_city.fillna("")
    _log(table, "KOREKSI", "nama kota dinormalisasi (aksen, '/uf', spasi, singkatan)", int(changed.sum()))

    invalid = (
        raw_city.str.contains("@", na=False)          # email
        | city.isna()
        | city.str.fullmatch(r"\d+", na=False)        # zip code / angka
        | (city.str.len() <= 2)                       # kode negara bagian ("sp")
    )
    invalid = _as_mask(invalid)
    fallback = zip_code.map(geo_city_by_zip)
    _log(table, "KOREKSI", "kota invalid → kota geolocation dari zip", int((invalid & fallback.notna()).sum()))
    _log(table, "NULL", "kota invalid & zip tidak ada di geolocation", int((invalid & fallback.isna()).sum()))
    return city.mask(invalid, fallback)


def _normalize_zip(series: pd.Series) -> pd.Series:
    return series.str.strip().str.zfill(5)


def _normalize_state(df: pd.DataFrame, table: str) -> pd.DataFrame:
    df = df.assign(state=df["state"].str.strip().str.upper())
    return _set_null(df, ~df["state"].isin(BRAZIL_STATES), "state", table, "kode negara bagian tidak dikenal")


# =============================================================================
# Dimensi
# =============================================================================

def transform_geolocation(raw: pd.DataFrame) -> pd.DataFrame:
    table = "geolocation"
    df = raw.rename(columns={
        "geolocation_zip_code_prefix": "zip_code_prefix", "geolocation_lat": "lat",
        "geolocation_lng": "lng", "geolocation_city": "city", "geolocation_state": "state",
    })
    df = _drop(df, df.duplicated(), table, "duplikat penuh (semua kolom sama)")
    df = df.assign(
        zip_code_prefix=_normalize_zip(df["zip_code_prefix"]),
        lat=_parse_number(df["lat"], table, "lat"),
        lng=_parse_number(df["lng"], table, "lng"),
    )
    b = BRAZIL_BOUNDS
    inside = df["lat"].between(b["lat_min"], b["lat_max"]) & df["lng"].between(b["lng_min"], b["lng_max"])
    df = _drop(df, ~inside, table, "koordinat di luar wilayah Brasil / tidak valid")
    df = _drop(df, ~df["zip_code_prefix"].str.fullmatch(r"\d{5}", na=False), table, "zip code bukan 5 digit")

    # City dinormalisasi SEBELUM mode, agar "são paulo" & "sao paulo" dihitung sebagai satu kota
    df = df.assign(city=normalize_city(df["city"]), state=df["state"].str.strip().str.upper())
    df = _drop(df, ~df["state"].isin(BRAZIL_STATES), table, "kode negara bagian tidak dikenal")

    # Req 4.3: satu baris per zip code
    result = (
        df.groupby("zip_code_prefix")[["lat", "lng"]].median()
        .join(_mode_by_key(df, "zip_code_prefix", "city"))
        .join(_mode_by_key(df, "zip_code_prefix", "state"))
        .reset_index()
    )
    _log(table, "AGREGASI", f"{len(df):,} titik koordinat → 1 baris per zip code", len(result))
    return result[["zip_code_prefix", "lat", "lng", "city", "state"]]


def _transform_party(raw: pd.DataFrame, prefix: str, id_column: str, geo_city_by_zip: pd.Series,
                     table: str) -> pd.DataFrame:
    """Customers & sellers punya struktur yang sama: id, zip, city, state."""
    df = raw.rename(columns={
        f"{prefix}_zip_code_prefix": "zip_code_prefix", f"{prefix}_city": "city", f"{prefix}_state": "state",
    })
    df = _deduplicate(df, [id_column], table)
    df = df.assign(zip_code_prefix=_normalize_zip(df["zip_code_prefix"]))
    df = _drop(df, ~df["zip_code_prefix"].str.fullmatch(r"\d{5}", na=False), table, "zip code bukan 5 digit")
    df = df.assign(city=_resolve_city(df["city"], df["zip_code_prefix"], geo_city_by_zip, table))
    return _normalize_state(df, table)


def transform_customers(raw: pd.DataFrame, geo_city_by_zip: pd.Series) -> pd.DataFrame:
    df = _transform_party(raw, "customer", "customer_id", geo_city_by_zip, "customers")
    return df[["customer_id", "customer_unique_id", "zip_code_prefix", "city", "state"]]


def transform_sellers(raw: pd.DataFrame, geo_city_by_zip: pd.Series) -> pd.DataFrame:
    df = _transform_party(raw, "seller", "seller_id", geo_city_by_zip, "sellers")
    return df[["seller_id", "zip_code_prefix", "city", "state"]]


def _clean_category(series: pd.Series) -> pd.Series:
    return series.str.strip().fillna(UNKNOWN_CATEGORY)


def transform_category_translation(raw: pd.DataFrame, product_categories: pd.Series) -> pd.DataFrame:
    """Req 5.2: setiap kategori yang dipakai produk WAJIB punya terjemahan."""
    table = "category_translation"
    df = raw.rename(columns={
        "product_category_name": "category_name",
        "product_category_name_english": "category_name_english",
    })
    df = df.assign(category_name=df["category_name"].str.strip(),
                   category_name_english=df["category_name_english"].str.strip())
    df = _deduplicate(df, ["category_name"], table)

    overrides = {k: v for k, v in CATEGORY_TRANSLATION_OVERRIDES.items() if k not in set(df["category_name"])}
    _log(table, "TAMBAH", "terjemahan manual (config.CATEGORY_TRANSLATION_OVERRIDES)", len(overrides))
    known = set(df["category_name"]) | set(overrides)
    missing = sorted(set(product_categories.dropna()) - known)
    _log(table, "TAMBAH", "kategori tanpa terjemahan → pakai nama asli", len(missing))

    extra = pd.DataFrame(
        list(overrides.items()) + [(name, name) for name in missing],
        columns=["category_name", "category_name_english"],
    )
    return pd.concat([df, extra], ignore_index=True)[["category_name", "category_name_english"]]


def transform_products(raw: pd.DataFrame, translation: pd.DataFrame) -> pd.DataFrame:
    table = "products"
    df = raw.rename(columns={
        "product_category_name": "category_name",
        "product_name_lenght": "name_length",                # typo sumber diperbaiki
        "product_description_lenght": "description_length",  # typo sumber diperbaiki
        "product_photos_qty": "photos_qty",
        "product_weight_g": "weight_g",
        "product_length_cm": "length_cm",
        "product_height_cm": "height_cm",
        "product_width_cm": "width_cm",
    })
    df = _deduplicate(df, ["product_id"], table)
    _log(table, "KOREKSI", f"kategori kosong → '{UNKNOWN_CATEGORY}'", int(df["category_name"].isna().sum()))
    df = df.assign(category_name=_clean_category(df["category_name"]))

    for column in ["name_length", "description_length", "photos_qty"]:
        df[column] = _parse_number(df[column], table, column).astype("Int64")
        df = _set_null(df, df[column] < 0, column, table, f"{column} negatif")
    for column in ["weight_g", "length_cm", "height_cm", "width_cm"]:
        df[column] = _parse_number(df[column], table, column).astype("Int64")
        df = _set_null(df, df[column] <= 0, column, table, f"{column} <= 0 (mustahil secara fisik)")

    df["volume_cm3"] = df["length_cm"] * df["height_cm"] * df["width_cm"]   # NULL jika salah satu NULL
    df["category_name_english"] = df["category_name"].map(
        translation.set_index("category_name")["category_name_english"])
    return df[["product_id", "category_name", "category_name_english", "name_length", "description_length",
               "photos_qty", "weight_g", "length_cm", "height_cm", "width_cm", "volume_cm3"]]


def transform_exchange_rates(raw: pd.DataFrame, until: pd.Timestamp) -> pd.DataFrame:
    """Req 5.6: kurs untuk SETIAP tanggal kalender; akhir pekan/libur diisi kurs hari kerja terakhir."""
    table = "exchange_rates"
    df = raw.assign(
        rate_date=pd.to_datetime(raw["rate_date"], format="%Y-%m-%d", errors="coerce"),
        brl_to_usd=_parse_number(raw["rate"], table, "rate"),
    )
    df = _drop(df, df["rate_date"].isna(), table, "tanggal kurs tidak valid")
    df = _drop(df, ~(df["brl_to_usd"] > 0), table, "kurs <= 0 / tidak valid")
    df = _deduplicate(df[["rate_date", "brl_to_usd"]], ["rate_date"], table)

    calendar = pd.date_range(df["rate_date"].min(), max(until, df["rate_date"].max()), freq="D", name="rate_date")
    df = df.set_index("rate_date").reindex(calendar)
    df["is_filled"] = df["brl_to_usd"].isna()
    df["brl_to_usd"] = df["brl_to_usd"].ffill()
    _log(table, "ISI", "tanggal tanpa kurs (akhir pekan/libur) → forward fill", int(df["is_filled"].sum()))
    return df.reset_index()[["rate_date", "brl_to_usd", "is_filled"]]


# =============================================================================
# Fakta / transaksi
# =============================================================================

def transform_orders(raw: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    table = "orders"
    df = raw.rename(columns={
        "order_purchase_timestamp": "purchase_at",
        "order_approved_at": "approved_at",
        "order_delivered_carrier_date": "delivered_carrier_at",
        "order_delivered_customer_date": "delivered_customer_at",
        "order_estimated_delivery_date": "estimated_delivery_date",
    })
    df = _deduplicate(df, ["order_id"], table)
    df = df.assign(order_status=df["order_status"].str.strip().str.lower())
    df = _drop(df, ~df["order_status"].isin(ORDER_STATUSES), table, "status order tidak dikenal")

    for column in ["purchase_at", "approved_at", "delivered_carrier_at", "delivered_customer_at",
                   "estimated_delivery_date"]:
        df[column] = _parse_datetime(df[column], table, column)
    df["estimated_delivery_date"] = df["estimated_delivery_date"].dt.normalize()   # DATE
    df = _drop(df, df["purchase_at"].isna() | df["estimated_delivery_date"].isna(), table,
               "tanggal beli / estimasi kosong")

    df = _drop(df, ~df["customer_id"].isin(customers["customer_id"]), table, "customer tidak dikenal")
    df = _drop(df, df["approved_at"] < df["purchase_at"], table, "approved sebelum purchase")
    df = _drop(df, df["delivered_customer_at"] < df["purchase_at"], table, "diterima customer sebelum purchase")

    # Req 8.5: carrier satu-satunya timestamp yang melanggar urutan di tiga sisi → kolomnya saja yang di-NULL.
    # df["delivered_carrier_at"] dibaca ulang tiap aturan agar baris yang sudah NULL tidak terhitung dua kali.
    df = _set_null(df, df["delivered_carrier_at"] < df["purchase_at"], "delivered_carrier_at", table,
                   "carrier sebelum purchase")
    df = _set_null(df, df["delivered_carrier_at"] < df["approved_at"], "delivered_carrier_at", table,
                   "carrier sebelum approved")
    df = _set_null(df, df["delivered_carrier_at"] > df["delivered_customer_at"], "delivered_carrier_at", table,
                   "carrier setelah diterima customer")

    # Req 7.1, 7.2: kolom kalkulasi (selisih hari kalender)
    df["purchase_date"] = df["purchase_at"].dt.normalize()
    delivered_date = df["delivered_customer_at"].dt.normalize()
    df["delivery_days"] = (delivered_date - df["purchase_date"]).dt.days.astype("Int64")
    df["delivery_delay_days"] = (delivered_date - df["estimated_delivery_date"]).dt.days.astype("Int64")
    df["is_late"] = df["delivery_delay_days"] > 0          # NA jika belum diterima
    return df[["order_id", "customer_id", "order_status", "purchase_at", "approved_at", "delivered_carrier_at",
               "delivered_customer_at", "estimated_delivery_date", "purchase_date", "delivery_days",
               "delivery_delay_days", "is_late"]]


def drop_orders_without_items(orders: pd.DataFrame, items: pd.DataFrame) -> pd.DataFrame:
    """Req 8.7: order tanpa item hanya wajar jika dibatalkan/tidak tersedia."""
    incomplete = ~orders["order_id"].isin(items["order_id"]) & ~orders["order_status"].isin(NON_REVENUE_STATUSES)
    return _drop(orders, incomplete, "orders", "tanpa item & status bukan canceled/unavailable")


def transform_order_items(raw: pd.DataFrame, orders: pd.DataFrame, products: pd.DataFrame,
                          sellers: pd.DataFrame) -> pd.DataFrame:
    table = "order_items"
    df = raw.rename(columns={"shipping_limit_date": "shipping_limit_at"})
    df = _deduplicate(df, ["order_id", "order_item_id"], table)
    df = _drop(df, ~df["order_id"].isin(orders["order_id"]), table, "order induk tidak ada / dibuang")
    df = _drop(df, ~df["product_id"].isin(products["product_id"]), table, "produk tidak dikenal")
    df = _drop(df, ~df["seller_id"].isin(sellers["seller_id"]), table, "seller tidak dikenal")

    df = df.assign(
        order_item_id=_parse_number(df["order_item_id"], table, "order_item_id").astype("Int64"),
        price=_parse_number(df["price"], table, "price").round(2),
        freight_value=_parse_number(df["freight_value"], table, "freight_value").round(2),
        shipping_limit_at=_parse_datetime(df["shipping_limit_at"], table, "shipping_limit_at"),
    )
    df = _drop(df, ~(df["order_item_id"] >= 1), table, "order_item_id < 1 / tidak valid")
    df = _drop(df, ~(df["price"] > 0), table, "price <= 0 / tidak valid")
    df = _drop(df, ~(df["freight_value"] >= 0), table, "freight_value < 0 / tidak valid")

    purchase_at = df["order_id"].map(orders.set_index("order_id")["purchase_at"])
    limit = df["shipping_limit_at"]
    out_of_range = (limit < purchase_at) | (limit > purchase_at + pd.Timedelta(days=MAX_SHIPPING_LIMIT_DAYS))
    df = _set_null(df, out_of_range, "shipping_limit_at", table,
                   f"batas kirim sebelum purchase / > {MAX_SHIPPING_LIMIT_DAYS} hari setelahnya")

    df["total_item_value"] = (df["price"] + df["freight_value"]).round(2)   # Req 7.3
    return df[["order_id", "order_item_id", "product_id", "seller_id", "shipping_limit_at", "price",
               "freight_value", "total_item_value"]]


def transform_order_payments(raw: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame:
    table = "order_payments"
    df = _deduplicate(raw, ["order_id", "payment_sequential"], table)
    df = _drop(df, ~df["order_id"].isin(orders["order_id"]), table, "order induk tidak ada / dibuang")
    df = df.assign(
        payment_type=df["payment_type"].str.strip().str.lower(),
        payment_sequential=_parse_number(df["payment_sequential"], table, "payment_sequential").astype("Int64"),
        payment_installments=_parse_number(df["payment_installments"], table, "payment_installments").astype("Int64"),
        payment_value=_parse_number(df["payment_value"], table, "payment_value").round(2),
    )
    df = _drop(df, ~(df["payment_sequential"] >= 1), table, "payment_sequential < 1 / tidak valid")
    df = _drop(df, ~(df["payment_value"] > 0), table, "payment_value <= 0 / tidak valid")
    df = _drop(df, ~df["payment_type"].isin(PAYMENT_TYPES), table, "payment_type tidak dikenal (not_defined)")

    zero = df["payment_installments"] == 0
    _log(table, "KOREKSI", "payment_installments 0 → 1", int(_as_mask(zero).sum()))
    df["payment_installments"] = df["payment_installments"].mask(_as_mask(zero), 1)
    df = _drop(df, ~(df["payment_installments"] >= 1), table, "payment_installments tidak valid")
    return df[["order_id", "payment_sequential", "payment_type", "payment_installments", "payment_value"]]


def transform_order_reviews(raw: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame:
    table = "order_reviews"
    df = raw.rename(columns={
        "review_comment_title": "comment_title",
        "review_comment_message": "comment_message",
        "review_creation_date": "creation_date",
        "review_answer_timestamp": "answer_at",
    })
    df = _deduplicate(df, ["review_id", "order_id"], table)
    df = _drop(df, ~df["order_id"].isin(orders["order_id"]), table, "order induk tidak ada / dibuang")

    df = df.assign(
        review_score=_parse_number(df["review_score"], table, "review_score").astype("Int64"),
        creation_date=_parse_datetime(df["creation_date"], table, "creation_date").dt.normalize(),  # DATE
        answer_at=_parse_datetime(df["answer_at"], table, "answer_at"),
    )
    df = _drop(df, ~df["review_score"].between(1, 5), table, "review_score di luar 1–5")
    df = _drop(df, df["creation_date"].isna(), table, "tanggal review kosong")
    purchase_date = df["order_id"].map(orders.set_index("order_id")["purchase_date"])
    df = _drop(df, df["creation_date"] < purchase_date, table, "review dibuat sebelum order dibeli")
    df = _set_null(df, df["answer_at"] < df["creation_date"], "answer_at", table, "dijawab sebelum review dibuat")

    for column in ["comment_title", "comment_message"]:
        cleaned = _clean_text(df[column])
        _log(table, "KOREKSI", f"{column}: spasi/baris baru dirapikan",
             int((cleaned.notna() & (cleaned != df[column])).sum()))
        _log(table, "NULL", f"{column}: hanya berisi spasi", int((cleaned.isna() & df[column].notna()).sum()))
        df[column] = cleaned

    df["has_comment"] = df["comment_title"].notna() | df["comment_message"].notna()     # Req 7.5
    df["response_hours"] = ((df["answer_at"] - df["creation_date"]).dt.total_seconds() / 3600).round(2)
    return df[["review_id", "order_id", "review_score", "comment_title", "comment_message", "creation_date",
               "answer_at", "has_comment", "response_hours"]]


# =============================================================================
# Entry point
# =============================================================================

def transform_all(raw: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Raw → clean, urutan mengikuti dependensi antar tabel, lalu data quality check (Req 8.13)."""
    geolocation = transform_geolocation(raw["geolocation"])
    geo_city_by_zip = geolocation.set_index("zip_code_prefix")["city"]
    customers = transform_customers(raw["customers"], geo_city_by_zip)
    sellers = transform_sellers(raw["sellers"], geo_city_by_zip)

    translation = transform_category_translation(
        raw["category_translation"], _clean_category(raw["products"]["product_category_name"]))
    products = transform_products(raw["products"], translation)

    # Item butuh order (FK), tapi aturan "order tanpa item" butuh item → dua langkah.
    # Membuang order tanpa item tidak membuat item yatim, karena order itu memang tidak punya item.
    orders = transform_orders(raw["orders"], customers)
    items = transform_order_items(raw["order_items"], orders, products, sellers)
    orders = drop_orders_without_items(orders, items)
    payments = transform_order_payments(raw["order_payments"], orders)
    reviews = transform_order_reviews(raw["order_reviews"], orders)

    exchange_rates = transform_exchange_rates(raw["exchange_rates"], until=orders["purchase_date"].max())

    clean = {
        "category_translation": translation, "geolocation": geolocation, "customers": customers,
        "sellers": sellers, "products": products, "exchange_rates": exchange_rates, "orders": orders,
        "order_items": items, "order_payments": payments, "order_reviews": reviews,
    }
    for name, df in clean.items():
        logger.info("%-20s : raw %9s → clean %9s baris", name, f"{len(raw[name]):,}", f"{len(df):,}")
    validate_clean(clean)
    return clean


if __name__ == "__main__":
    # Jalankan extract + transform saja (tanpa database): python -m transform.transform
    from config import setup_logging
    from extract.extract import extract_all

    setup_logging()
    transform_all(extract_all())
