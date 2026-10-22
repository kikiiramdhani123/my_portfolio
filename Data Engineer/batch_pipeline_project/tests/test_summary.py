"""Requirement 7.6 & 10: nilai mart dibandingkan dengan angka yang dihitung manual.

Order penjualan di dataset mini: O1 (Jumat 2018-01-05, 165 BRL) dan O2 (Sabtu 2018-01-06, 220 BRL).
O3 canceled → tidak masuk. Kurs Jumat 0,31 juga dipakai hari Sabtu (forward fill).
"""

import pandas as pd
import pytest

from sample_data import O1, O2, S1, S2
from transform.summary import latest_review_score


def row(df, **key):
    mask = pd.Series(True, index=df.index)
    for column, value in key.items():
        mask &= df[column] == value
    assert mask.sum() == 1, f"harus tepat 1 baris untuk {key}"
    return df[mask].iloc[0]


def test_latest_review_wins(clean_sample):
    scores = latest_review_score(clean_sample["order_reviews"])
    assert scores[O1] == 5      # R1 dijawab 12 Jan > R5 dijawab 11 Jan
    assert scores[O2] == 4      # R3 lebih baru dari R2


def test_daily_sales(mart_sample):
    daily = mart_sample["daily_sales"]
    assert len(daily) == 2                                     # canceled (7 Jan) tidak masuk
    friday = row(daily, sales_date=pd.Timestamp("2018-01-05"))
    assert (friday["total_orders"], friday["total_items"]) == (1, 2)
    assert friday["item_revenue_brl"] == pytest.approx(150.00)
    assert friday["freight_revenue_brl"] == pytest.approx(15.00)
    assert friday["total_revenue_brl"] == pytest.approx(165.00)
    assert friday["total_revenue_usd"] == pytest.approx(51.15)  # 165 × 0,31
    saturday = row(daily, sales_date=pd.Timestamp("2018-01-06"))
    assert saturday["total_revenue_usd"] == pytest.approx(68.20)  # 220 × 0,31 (kurs Jumat)


def test_monthly_category_sales(mart_sample):
    monthly = mart_sample["monthly_category_sales"]
    beauty = row(monthly, category_name_english="health_beauty")
    assert beauty["sales_month"] == pd.Timestamp("2018-01-01")
    assert (beauty["total_orders"], beauty["total_items"]) == (2, 2)
    assert beauty["total_revenue_brl"] == pytest.approx(330.00)    # 110 + 220
    assert beauty["avg_item_price_brl"] == pytest.approx(150.00)   # (100 + 200) / 2
    assert row(monthly, category_name_english="unknown")["total_revenue_brl"] == pytest.approx(55.00)


def test_seller_performance_counts_each_order_once(mart_sample):
    sellers = mart_sample["seller_performance"]
    s1 = row(sellers, seller_id=S1)
    # S1 punya 2 item di order O1: review & pengiriman O1 dihitung SEKALI, bukan dua kali
    assert (s1["total_orders"], s1["total_items"]) == (1, 2)
    assert s1["total_revenue_brl"] == pytest.approx(165.00)
    assert (s1["avg_review_score"], s1["avg_delivery_days"], s1["late_delivery_rate"]) == (5.0, 5.0, 0.0)
    s2 = row(sellers, seller_id=S2)
    assert (s2["avg_review_score"], s2["avg_delivery_days"], s2["late_delivery_rate"]) == (4.0, 19.0, 1.0)


def test_state_delivery_summary(mart_sample):
    sp = row(mart_sample["state_delivery_summary"], customer_state="SP")
    assert (sp["total_customers"], sp["total_orders"]) == (2, 2)
    assert sp["total_revenue_brl"] == pytest.approx(385.00)
    assert sp["avg_delivery_days"] == pytest.approx(12.0)          # (5 + 19) / 2
    assert sp["late_delivery_rate"] == pytest.approx(0.5)
    assert sp["avg_review_score"] == pytest.approx(4.5)            # (5 + 4) / 2


def test_missing_exchange_rate_fails_loudly(clean_sample):
    from transform.summary import build_summaries
    clean = dict(clean_sample)
    clean["exchange_rates"] = clean_sample["exchange_rates"].iloc[:1]   # kurs 5 & 6 Jan hilang
    with pytest.raises(ValueError, match="tidak punya kurs"):
        build_summaries(clean)
