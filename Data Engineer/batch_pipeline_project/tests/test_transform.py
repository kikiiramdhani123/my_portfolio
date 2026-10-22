"""Requirement 4–8: setiap aturan transform diuji dengan data mini (tests/sample_data.py)."""

import pandas as pd
import pytest

from sample_data import C1, C2, O1, O2, O3, O4, O5, P1, P2, R1, R2, R3, R4, R5, S1, S2
from transform import transform as t


# ---------- normalisasi kota (Req 6.4, 6.5) -------------------------------------

@pytest.mark.parametrize("raw, expected", [
    ("são paulo", "sao paulo"),                                    # aksen
    ("sa£o paulo", "sao paulo"),                                   # karakter rusak
    ("santa barbara d´oeste", "santa barbara d'oeste"),            # apostrof tidak standar
    ("maua/sao paulo", "maua"),                                    # akhiran negara bagian
    ("rio de janeiro \\rio de janeiro", "rio de janeiro"),
    ("novo hamburgo, rio grande do sul, brasil", "novo hamburgo"),
    ("arraial d'ajuda (porto seguro)", "arraial d'ajuda"),         # keterangan dalam kurung
    ("ferraz de  vasconcelos", "ferraz de vasconcelos"),           # spasi ganda
    ("itu", "itu"),                                                # kota asli 3 huruf tetap utuh
])
def test_normalize_city(raw, expected):
    assert t.normalize_city(pd.Series([raw])).iloc[0] == expected


def test_invalid_seller_city_resolved_from_geolocation(raw_sample):
    geo_city = pd.Series({"01037": "sao paulo", "13023": "campinas"})
    sellers = t.transform_sellers(raw_sample["sellers"], geo_city).set_index("seller_id")
    assert sellers.loc[S1, "city"] == "campinas"     # "campinas/sp"
    assert sellers.loc[S2, "city"] == "sao paulo"    # "04482255" → kota dari zip 01037


@pytest.mark.parametrize("raw_city, expected", [
    ("sbc/sp", "sao bernardo do campo"),             # singkatan dikenal
    ("sp", "sao paulo"),                             # kode negara bagian → kota dari zip
    ("vendas@loja.com.br", "sao paulo"),             # email → kota dari zip
])
def test_more_invalid_city_patterns(raw_sample, raw_city, expected):
    raw = raw_sample["sellers"].copy()
    raw.loc[1, "seller_city"] = raw_city
    sellers = t.transform_sellers(raw, pd.Series({"01037": "sao paulo"})).set_index("seller_id")
    assert sellers.loc[S2, "city"] == expected


# ---------- geolocation (Req 4.1, 4.3, 8.4) --------------------------------------

def test_geolocation_one_row_per_zip_inside_brazil(raw_sample):
    geo = t.transform_geolocation(raw_sample["geolocation"]).set_index("zip_code_prefix")
    assert sorted(geo.index) == ["01037", "13023"]           # 99999 (New York) dibuang
    # Tanpa normalisasi sebelum mode: "são paulo" / "sao paulo" / "santo andre" seri 1-1-1
    assert geo.loc["01037", "city"] == "sao paulo"
    assert geo.loc["01037", "lat"] == pytest.approx(-23.55)  # median setelah duplikat penuh dibuang


# ---------- produk & kategori (Req 5.1–5.3, 7.4, 8.10) ---------------------------

def test_category_translation_adds_missing_categories(raw_sample):
    translation = t.transform_category_translation(
        raw_sample["category_translation"], pd.Series(["beleza_saude", "unknown", "kategori_baru"]))
    mapping = translation.set_index("category_name")["category_name_english"]
    assert mapping["beleza_saude"] == "health_beauty"
    assert mapping["unknown"] == "unknown"
    assert mapping["pc_gamer"] == "pc_gamer"                 # override manual dari config
    assert mapping["kategori_baru"] == "kategori_baru"       # tanpa terjemahan → nama asli


def test_products(raw_sample):
    translation = t.transform_category_translation(raw_sample["category_translation"], pd.Series(["unknown"]))
    products = t.transform_products(raw_sample["products"], translation).set_index("product_id")
    assert "name_length" in products.columns                 # typo "lenght" diperbaiki
    assert products.loc[P1, "volume_cm3"] == 16 * 10 * 14
    assert products.loc[P2, "category_name"] == "unknown"
    assert products.loc[P2, "category_name_english"] == "unknown"
    assert pd.isna(products.loc[P2, "weight_g"])             # 0 gram → NULL, bukan dibuang
    assert pd.isna(products.loc[P2, "name_length"])          # kosong tetap NULL, bukan 0


# ---------- orders (Req 6, 7.1, 7.2, 8.5–8.7) -------------------------------------

@pytest.fixture
def orders(raw_sample):
    customers = pd.DataFrame({"customer_id": [C1, C2]})
    return t.transform_orders(raw_sample["orders"], customers).set_index("order_id")


def test_orders_dates_parsed_and_calculated(orders):
    o1 = orders.loc[O1]
    assert o1["purchase_at"] == pd.Timestamp("2018-01-05 10:00:00")
    assert o1["purchase_date"] == pd.Timestamp("2018-01-05")
    assert (o1["delivery_days"], o1["delivery_delay_days"], o1["is_late"]) == (5, -10, False)
    o2 = orders.loc[O2]
    assert (o2["delivery_days"], o2["delivery_delay_days"], o2["is_late"]) == (19, 5, True)
    assert pd.isna(orders.loc[O3, "is_late"])                # belum diterima → NULL, bukan False


def test_carrier_before_purchase_is_nulled_but_order_kept(orders):
    assert O2 in orders.index
    assert pd.isna(orders.loc[O2, "delivered_carrier_at"])
    assert orders.loc[O1, "delivered_carrier_at"] == pd.Timestamp("2018-01-06 09:00:00")


def test_order_delivered_before_purchase_is_dropped(orders):
    assert O5 not in orders.index


def test_orders_without_items(orders):
    items = pd.DataFrame({"order_id": [O1, O2]})
    kept = t.drop_orders_without_items(orders.reset_index(), items)["order_id"].tolist()
    assert O3 in kept          # canceled tanpa item: wajar
    assert O4 not in kept      # shipped tanpa item: order tidak lengkap


# ---------- items, payments, reviews (Req 7.3, 7.5, 8.1–8.3, 8.8, 8.9, 8.11) -------

@pytest.fixture
def final_orders(orders):
    return orders.reset_index()[lambda d: d["order_id"].isin([O1, O2, O3])]


def test_order_items(raw_sample, final_orders):
    items = t.transform_order_items(raw_sample["order_items"], final_orders,
                                    pd.DataFrame({"product_id": [P1, P2]}), pd.DataFrame({"seller_id": [S1, S2]}))
    assert O5 not in set(items["order_id"])                  # ikut dibuang bersama order-nya
    o1 = items.set_index(["order_id", "order_item_id"])
    assert o1.loc[(O1, 1), "total_item_value"] == pytest.approx(110.0)
    assert pd.isna(o1.loc[(O1, 2), "shipping_limit_at"])     # tahun 2020 → NULL


def test_order_payments(raw_sample, final_orders):
    payments = t.transform_order_payments(raw_sample["order_payments"], final_orders)
    assert sorted(zip(payments["order_id"], payments["payment_sequential"])) == [(O1, 1), (O2, 1)]
    assert payments.set_index("order_id").loc[O1, "payment_installments"] == 1   # 0 → 1
    assert set(payments["payment_type"]) <= {"credit_card", "boleto"}           # 0 BRL & not_defined dibuang


def test_order_reviews(raw_sample, final_orders):
    reviews = t.transform_order_reviews(raw_sample["order_reviews"], final_orders).set_index("review_id")
    assert R4 not in reviews.index                           # dibuat sebelum order dibeli
    assert reviews.loc[R1, "comment_message"] == "muito bom produto"
    assert reviews.loc[R1, "response_hours"] == pytest.approx(36.0)
    assert reviews.loc[R1, "has_comment"]
    assert pd.isna(reviews.loc[R5, "comment_title"])         # hanya spasi → NULL
    assert not reviews.loc[R5, "has_comment"]
    assert {R2, R3} <= set(reviews.index)


# ---------- exchange rates (Req 5.6) --------------------------------------------------

def test_exchange_rates_forward_fill(raw_sample):
    fx = t.transform_exchange_rates(raw_sample["exchange_rates"], until=pd.Timestamp("2018-01-08"))
    fx = fx.set_index(fx["rate_date"].dt.strftime("%Y-%m-%d"))
    assert list(fx.index) == ["2018-01-04", "2018-01-05", "2018-01-06", "2018-01-07", "2018-01-08"]
    assert fx.loc["2018-01-07", "brl_to_usd"] == pytest.approx(0.31)   # Minggu = kurs Jumat
    assert fx["is_filled"].tolist() == [False, False, True, True, False]


# ---------- end-to-end dataset mini ---------------------------------------------------

def test_transform_all_row_counts(clean_sample):
    counts = {name: len(df) for name, df in clean_sample.items()}
    assert counts == {
        "category_translation": 4,   # 1 + pc_gamer, portateis_…, unknown
        "geolocation": 2, "customers": 2, "sellers": 2, "products": 2,
        "exchange_rates": 5, "orders": 3, "order_items": 3, "order_payments": 2, "order_reviews": 4,
    }
