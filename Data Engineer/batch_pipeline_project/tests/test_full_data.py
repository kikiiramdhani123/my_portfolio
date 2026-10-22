"""Regression test dengan dataset Olist lengkap (tanpa database & tanpa internet).

Angka yang diharapkan berasal dari run yang sudah diverifikasi (Task 6–8). Jika aturan transform
diubah dan angka ini berubah, test gagal → perubahan harus disengaja dan spec ikut diperbarui.
Dilewati otomatis jika folder data/ tidak ada (dataset tidak ikut di-commit).
"""

import pandas as pd
import pytest

from config import DATA_DIR
from extract.extract import extract_csv_files
from transform.summary import build_summaries
from transform.transform import transform_all

pytestmark = [
    pytest.mark.slow,
    pytest.mark.skipif(not (DATA_DIR / "olist_orders_dataset.csv").exists(), reason="dataset Olist tidak ada di data/"),
]


@pytest.fixture(scope="module")
def full_run():
    raw = extract_csv_files()
    # Kurs sintetis agar test tidak bergantung pada internet; nilainya tidak memengaruhi jumlah baris
    days = pd.date_range("2016-08-26", "2018-10-17", freq="B").strftime("%Y-%m-%d")
    raw["exchange_rates"] = pd.DataFrame({"rate_date": days, "base_currency": "BRL", "quote_currency": "USD",
                                          "rate": "0.3"}, dtype="str")
    clean = transform_all(raw)        # termasuk 121 quality check
    mart = build_summaries(clean)     # termasuk 50 quality check
    return clean, mart


def test_clean_row_counts(full_run):
    clean, _ = full_run
    assert {name: len(df) for name, df in clean.items() if name != "exchange_rates"} == {
        "category_translation": 74, "geolocation": 19_010, "customers": 99_441, "sellers": 3_095,
        "products": 32_951, "orders": 99_433, "order_items": 112_650, "order_payments": 103_869,
        "order_reviews": 99_154,
    }


def test_mart_row_counts(full_run):
    _, mart = full_run
    assert {name: len(df) for name, df in mart.items()} == {
        "daily_sales": 614, "monthly_category_sales": 1_282, "seller_performance": 3_053,
        "state_delivery_summary": 27,
    }


def test_anomalies_from_profiling_are_handled(full_run):
    clean, _ = full_run
    orders = clean["orders"]
    # 1.783 NULL asli, dikurangi 7 order created/invoiced tanpa item yang dibuang (carrier-nya memang NULL),
    # ditambah 1.382 carrier tidak logis yang di-NULL-kan
    assert orders["delivered_carrier_at"].isna().sum() == (1_783 - 7) + 1_382
    assert clean["sellers"]["city"].str.fullmatch(r"[a-z0-9' \-.]+").all()
    assert clean["products"]["weight_g"].isna().sum() == 2 + 4             # kosong asli + berat 0
