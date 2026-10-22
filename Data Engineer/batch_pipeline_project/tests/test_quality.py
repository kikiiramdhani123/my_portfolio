"""Requirement 8.13 & 10.6–10.7: mutation test.

Data yang sudah bersih HARUS lolos; setiap anomali yang sengaja disuntik HARUS tertangkap.
Validator yang tidak pernah gagal sama berbahayanya dengan tidak punya validator.
"""

import pandas as pd
import pytest

from transform.quality import DataQualityError, validate_clean, validate_summaries


def mutated(frames: dict, table: str, func) -> dict:
    copy = {name: df.copy() for name, df in frames.items()}
    copy[table] = func(copy[table].copy())
    return copy


def set_first(column, value):
    def apply(df):
        df.loc[df.index[0], column] = value(df) if callable(value) else value
        return df
    return apply


def add_to_first(column, delta):
    return set_first(column, lambda df: df.loc[df.index[0], column] + delta)


def duplicate_first(df):
    return pd.concat([df, df.head(1)], ignore_index=True)


def test_clean_sample_passes(clean_sample):
    validate_clean(clean_sample)


CLEAN_MUTATIONS = {
    "PK orders dobel": ("orders", duplicate_first),
    "FK item ke order tak dikenal": ("order_items", set_first("order_id", "f" * 32)),
    "carrier sebelum purchase": ("orders", set_first(
        "delivered_carrier_at", lambda df: df.loc[df.index[0], "purchase_at"] - pd.Timedelta(hours=1))),
    "price 0": ("order_items", set_first("price", 0.0)),
    "payment not_defined": ("order_payments", set_first("payment_type", "not_defined")),
    "cicilan 0": ("order_payments", set_first("payment_installments", 0)),
    "skor review 6": ("order_reviews", set_first("review_score", 6)),
    "review sebelum purchase": ("order_reviews", set_first("creation_date", pd.Timestamp("2010-01-01"))),
    "komentar spasi ganda": ("order_reviews", set_first("comment_message", "bom  produto")),
    "kota beraksen": ("sellers", set_first("city", "são paulo")),
    "kota = kode UF": ("customers", set_first("city", "sp")),
    "zip 4 digit": ("customers", set_first("zip_code_prefix", "1037")),
    "koordinat di luar Brasil": ("geolocation", set_first("lat", 40.0)),
    "berat 0": ("products", set_first("weight_g", 0)),
    "lubang di kalender kurs": ("exchange_rates", lambda df: df.drop(df.index[1])),
    "is_late tidak konsisten": ("orders", set_first("is_late", lambda df: not df.loc[df.index[0], "is_late"])),
    "total_item_value salah": ("order_items", set_first("total_item_value", 1.0)),
    "ID bukan hex": ("customers", set_first("customer_unique_id", "ABC")),
}


@pytest.mark.parametrize("name", CLEAN_MUTATIONS)
def test_clean_anomaly_is_caught(clean_sample, name):
    table, func = CLEAN_MUTATIONS[name]
    with pytest.raises(DataQualityError):
        validate_clean(mutated(clean_sample, table, func))


def test_mart_sample_passes(mart_sample, clean_sample):
    validate_summaries(mart_sample, clean_sample)


MART_MUTATIONS = {
    "baris seller dobel (join fan-out)": ("seller_performance", duplicate_first),
    "revenue harian +100": ("daily_sales", add_to_first("total_revenue_brl", 100)),
    "item revenue tidak konsisten": ("daily_sales", add_to_first("item_revenue_brl", 5)),
    "satu negara bagian hilang": ("state_delivery_summary", lambda df: df.iloc[1:] if len(df) > 1 else df.iloc[0:0]),
    "revenue kategori +0,50": ("monthly_category_sales", add_to_first("total_revenue_brl", 0.5)),
    "revenue seller +0,02": ("seller_performance", add_to_first("total_revenue_brl", 0.02)),
    "USD kategori +10": ("monthly_category_sales", add_to_first("total_revenue_usd", 10)),
    "late_delivery_rate 1,5": ("seller_performance", set_first("late_delivery_rate", 1.5)),
    "avg_review_score 0": ("state_delivery_summary", set_first("avg_review_score", 0.0)),
    "order harian +1": ("daily_sales", add_to_first("total_orders", 1)),
}


@pytest.mark.parametrize("name", MART_MUTATIONS)
def test_mart_anomaly_is_caught(mart_sample, clean_sample, name):
    table, func = MART_MUTATIONS[name]
    with pytest.raises(DataQualityError):
        validate_summaries(mutated(mart_sample, table, func), clean_sample)
