"""Summary: membangun tabel mart (agregasi) dari tabel clean.

Definisi metrik ada di specs/design.md §3.3. Pola yang dipakai di seluruh modul ini:
  1. siapkan tabel "fakta" di level paling detail yang dibutuhkan (per item / per order)
  2. baru agregasi ke level tabel mart
Agregasi langsung dari hasil join item × review (misalnya) akan menghitung satu order berkali-kali.
"""

import logging

import pandas as pd

from config import NON_REVENUE_STATUSES
from transform.quality import validate_summaries

logger = logging.getLogger(__name__)


# =============================================================================
# Fakta dasar
# =============================================================================

def sales_orders(orders: pd.DataFrame) -> pd.DataFrame:
    """Order yang dihitung sebagai penjualan (Req 10.5)."""
    return orders[~orders["order_status"].isin(NON_REVENUE_STATUSES)]


def latest_review_score(reviews: pd.DataFrame) -> pd.Series:
    """Skor review terakhir per order (answer_at, lalu creation_date; review_id agar deterministik)."""
    ordered = reviews.sort_values(["order_id", "answer_at", "creation_date", "review_id"], na_position="first")
    return ordered.drop_duplicates("order_id", keep="last").set_index("order_id")["review_score"]


def _sales_items(clean: dict[str, pd.DataFrame], orders: pd.DataFrame) -> pd.DataFrame:
    """Level item: satu baris per item dari order penjualan + tanggal beli, kategori, nilai USD."""
    items = clean["order_items"].merge(orders[["order_id", "purchase_date"]], on="order_id", how="inner")
    items = items.merge(clean["products"][["product_id", "category_name_english"]], on="product_id", how="left")

    rate = items["purchase_date"].map(clean["exchange_rates"].set_index("rate_date")["brl_to_usd"])
    if rate.isna().any():
        # sum() di pandas melewati NaN diam-diam → revenue USD akan kurang tanpa error
        raise ValueError(f"{int(rate.isna().sum())} item tidak punya kurs pada tanggal belinya")
    return items.assign(
        total_item_value_usd=items["total_item_value"] * rate,
        sales_month=items["purchase_date"].dt.to_period("M").dt.to_timestamp(),
    )


def _order_facts(clean: dict[str, pd.DataFrame], orders: pd.DataFrame, items: pd.DataFrame) -> pd.DataFrame:
    """Level order: revenue, skor review terakhir, dan metrik pengiriman (hanya untuk order delivered)."""
    delivered = (orders["order_status"] == "delivered") & orders["delivered_customer_at"].notna()
    return orders.assign(
        revenue_brl=orders["order_id"].map(items.groupby("order_id")["total_item_value"].sum()),
        review_score=orders["order_id"].map(latest_review_score(clean["order_reviews"])),
        delivered_days=orders["delivery_days"].where(delivered),
        delivered_late=orders["is_late"].where(delivered),
    )[["order_id", "customer_id", "revenue_brl", "review_score", "delivered_days", "delivered_late"]]


def _delivery_and_review_metrics(grouped) -> pd.DataFrame:
    return pd.DataFrame({
        "avg_review_score": grouped["review_score"].mean().astype(float).round(2),
        "avg_delivery_days": grouped["delivered_days"].mean().astype(float).round(2),
        # mean() pada boolean = proporsi True; NA (belum terkirim) tidak ikut dihitung
        "late_delivery_rate": grouped["delivered_late"].mean().astype(float).round(4),
    })


# =============================================================================
# Tabel mart
# =============================================================================

def build_daily_sales(items: pd.DataFrame) -> pd.DataFrame:
    g = items.groupby("purchase_date")
    df = pd.DataFrame({
        "total_orders": g["order_id"].nunique(),
        "total_items": g.size(),
        "item_revenue_brl": g["price"].sum().round(2),
        "freight_revenue_brl": g["freight_value"].sum().round(2),
        "total_revenue_brl": g["total_item_value"].sum().round(2),
        "total_revenue_usd": g["total_item_value_usd"].sum().round(2),
    })
    df["avg_order_value_brl"] = (df["total_revenue_brl"] / df["total_orders"]).round(2)
    return df.rename_axis("sales_date").reset_index()


def build_monthly_category_sales(items: pd.DataFrame) -> pd.DataFrame:
    g = items.groupby(["sales_month", "category_name_english"])
    return pd.DataFrame({
        "total_orders": g["order_id"].nunique(),
        "total_items": g.size(),
        "total_revenue_brl": g["total_item_value"].sum().round(2),
        "total_revenue_usd": g["total_item_value_usd"].sum().round(2),
        "avg_item_price_brl": g["price"].mean().round(2),
    }).reset_index()


def build_seller_performance(items: pd.DataFrame, order_facts: pd.DataFrame,
                             sellers: pd.DataFrame) -> pd.DataFrame:
    g = items.groupby("seller_id")
    volume = pd.DataFrame({
        "total_orders": g["order_id"].nunique(),
        "total_items": g.size(),
        "total_revenue_brl": g["total_item_value"].sum().round(2),
    })
    # Review & pengiriman di level (seller, order): order dengan 3 item dari seller yang sama dihitung 1x
    seller_orders = items[["seller_id", "order_id"]].drop_duplicates().merge(order_facts, on="order_id")
    quality = _delivery_and_review_metrics(seller_orders.groupby("seller_id"))
    df = volume.join(quality).reset_index()
    df["seller_state"] = df["seller_id"].map(sellers.set_index("seller_id")["state"])
    return df[["seller_id", "seller_state", "total_orders", "total_items", "total_revenue_brl",
               "avg_review_score", "avg_delivery_days", "late_delivery_rate"]]


def build_state_delivery_summary(order_facts: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    facts = order_facts.merge(customers[["customer_id", "customer_unique_id", "state"]], on="customer_id")
    g = facts.groupby("state")
    df = pd.DataFrame({
        "total_customers": g["customer_unique_id"].nunique(),
        "total_orders": g.size(),
        "total_revenue_brl": g["revenue_brl"].sum().round(2),
    }).join(_delivery_and_review_metrics(g))
    return df.rename_axis("customer_state").reset_index()[
        ["customer_state", "total_customers", "total_orders", "total_revenue_brl",
         "avg_delivery_days", "late_delivery_rate", "avg_review_score"]]


def build_summaries(clean: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Clean → mart, lalu rekonsiliasi & quality check (Req 10.6, 10.7)."""
    orders = sales_orders(clean["orders"])
    items = _sales_items(clean, orders)
    facts = _order_facts(clean, orders, items)

    mart = {
        "daily_sales": build_daily_sales(items),
        "monthly_category_sales": build_monthly_category_sales(items),
        "seller_performance": build_seller_performance(items, facts, clean["sellers"]),
        "state_delivery_summary": build_state_delivery_summary(facts, clean["customers"]),
    }
    for name, df in mart.items():
        logger.info("mart.%-24s : %7s baris", name, f"{len(df):,}")
    validate_summaries(mart, clean)
    return mart


if __name__ == "__main__":
    # Extract + transform + summary tanpa database: python -m transform.summary
    from config import setup_logging
    from extract.extract import extract_all
    from transform.transform import transform_all

    setup_logging()
    for name, frame in build_summaries(transform_all(extract_all())).items():
        print(f"\n=== {name} ===")
        print(frame.head(5).to_string(index=False))
