"""Dataset mini untuk unit test: bentuknya sama persis dengan hasil extract (semua kolom teks).

Setiap baris sengaja dibuat untuk menguji satu aturan. Angka yang diharapkan di test_summary.py
dihitung manual dari data di bawah ini:

  O1  delivered, 2 item (P1 + P2), 2 review (yang terakhir dijawab: skor 5), cicilan 0 → 1
  O2  delivered TERLAMBAT, carrier sebelum purchase → NULL, 2 review (terakhir: skor 4), voucher 0 BRL dibuang
  O3  canceled tanpa item → dipertahankan; review sebelum purchase dibuang; payment not_defined dibuang
  O4  shipped TANPA item → order dibuang, payment-nya ikut dibuang
  O5  diterima sebelum dibeli → order dibuang, item-nya ikut dibuang
"""

import pandas as pd

from config import CSV_SOURCES


def hex_id(kind: str, n: int) -> str:
    """ID 32 karakter heksadesimal seperti ID Olist. kind = 1 karakter hex pembeda jenis."""
    return f"{kind}{n:031x}"


O1, O2, O3, O4, O5 = (hex_id("a", i) for i in range(1, 6))
C1, C2 = hex_id("b", 1), hex_id("b", 2)
U1, U2 = hex_id("f", 1), hex_id("f", 2)
S1, S2 = hex_id("c", 1), hex_id("c", 2)
P1, P2 = hex_id("d", 1), hex_id("d", 2)
R1, R2, R3, R4, R5 = (hex_id("e", i) for i in range(1, 6))

EXCHANGE_RATE_COLUMNS = ["rate_date", "base_currency", "quote_currency", "rate"]


def make_raw(table: str, rows: list[tuple]) -> pd.DataFrame:
    columns = EXCHANGE_RATE_COLUMNS if table == "exchange_rates" else CSV_SOURCES[table]["columns"]
    return pd.DataFrame(rows, columns=columns, dtype="str")


def build_raw_sample() -> dict[str, pd.DataFrame]:
    return {
        "geolocation": make_raw("geolocation", [
            ("01037", "-23.54", "-46.63", "são paulo", "SP"),
            ("01037", "-23.54", "-46.63", "são paulo", "SP"),     # duplikat penuh
            ("01037", "-23.56", "-46.65", "sao paulo", "SP"),     # sama dengan atas setelah normalisasi
            ("01037", "-23.55", "-46.64", "santo andre", "SP"),
            ("13023", "-22.90", "-47.06", "campinas", "SP"),
            ("99999", "40.71", "-74.00", "new york", "SP"),       # di luar Brasil
        ]),
        "customers": make_raw("customers", [
            (C1, U1, "01037", "sao paulo", "SP"),
            (C2, U2, "13023", "campinas", "SP"),
        ]),
        "sellers": make_raw("sellers", [
            (S1, "13023", "campinas/sp", "SP"),                   # akhiran /uf
            (S2, "01037", "04482255", "SP"),                      # zip code di kolom kota
        ]),
        "category_translation": make_raw("category_translation", [("beleza_saude", "health_beauty")]),
        "products": make_raw("products", [
            (P1, "beleza_saude", "40", "287", "1", "225", "16", "10", "14"),
            (P2, None, None, None, None, "0", "30", "25", "30"),  # tanpa kategori, berat 0
        ]),
        "orders": make_raw("orders", [
            (O1, C1, "delivered", "2018-01-05 10:00:00", "2018-01-05 10:10:00", "2018-01-06 09:00:00",
             "2018-01-10 12:00:00", "2018-01-20 00:00:00"),
            (O2, C2, "delivered", "2018-01-06 11:00:00", "2018-01-06 11:30:00", "2018-01-06 10:00:00",
             "2018-01-25 08:00:00", "2018-01-20 00:00:00"),
            (O3, C1, "canceled", "2018-01-07 09:00:00", None, None, None, "2018-01-25 00:00:00"),
            (O4, C2, "shipped", "2018-01-07 15:00:00", "2018-01-07 15:10:00", "2018-01-08 10:00:00",
             None, "2018-01-25 00:00:00"),
            (O5, C1, "delivered", "2018-01-08 10:00:00", "2018-01-08 10:05:00", None,
             "2018-01-07 10:00:00", "2018-01-25 00:00:00"),
        ]),
        "order_items": make_raw("order_items", [
            (O1, "1", P1, S1, "2018-01-10 10:00:00", "100.00", "10.00"),
            (O1, "2", P2, S1, "2020-01-01 00:00:00", "50.00", "5.00"),   # batas kirim > 90 hari
            (O2, "1", P1, S2, "2018-01-12 11:00:00", "200.00", "20.00"),
            (O5, "1", P1, S1, "2018-01-12 10:00:00", "30.00", "3.00"),
        ]),
        "order_payments": make_raw("order_payments", [
            (O1, "1", "credit_card", "0", "165.00"),
            (O2, "1", "boleto", "1", "220.00"),
            (O2, "2", "voucher", "1", "0.00"),
            (O3, "1", "not_defined", "1", "0.00"),
            (O4, "1", "credit_card", "1", "10.00"),
        ]),
        "order_reviews": make_raw("order_reviews", [
            (R1, O1, "5", None, "  muito   bom \n produto ", "2018-01-11 00:00:00", "2018-01-12 12:00:00"),
            (R5, O1, "3", "   ", "   ", "2018-01-11 00:00:00", "2018-01-11 06:00:00"),
            (R2, O2, "2", "ruim", None, "2018-01-26 00:00:00", "2018-01-27 00:00:00"),
            (R3, O2, "4", None, None, "2018-01-28 00:00:00", "2018-01-29 00:00:00"),
            (R4, O3, "1", None, None, "2017-12-01 00:00:00", "2017-12-02 00:00:00"),
        ]),
        "exchange_rates": make_raw("exchange_rates", [
            ("2018-01-04", "BRL", "USD", "0.30"),   # Kamis
            ("2018-01-05", "BRL", "USD", "0.31"),   # Jumat
            ("2018-01-08", "BRL", "USD", "0.32"),   # Senin (Sabtu & Minggu tidak ada kurs)
        ]),
    }
