"""Extract: membaca CSV Olist dan mengambil kurs BRL→USD dari Frankfurter API.

Prinsip extract: ambil data APA ADANYA. Tidak ada pembersihan di sini;
itu tugas transform. Output setiap fungsi adalah DataFrame berisi teks.
"""

import logging
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

from config import (
    API_BACKOFF_SECONDS,
    API_MAX_RETRIES,
    API_TIMEOUT_SECONDS,
    BASE_CURRENCY,
    CSV_SOURCES,
    DATA_DIR,
    EXCHANGE_RATE_API_URL,
    EXCHANGE_RATE_LOOKBACK_DAYS,
    QUOTE_CURRENCY,
)

logger = logging.getLogger(__name__)


def extract_csv_files(data_dir: Path = DATA_DIR) -> dict[str, pd.DataFrame]:
    """Membaca semua CSV di CSV_SOURCES. Return: {nama_tabel_raw: DataFrame}."""
    frames = {}
    for table, source in CSV_SOURCES.items():
        path = data_dir / source["file"]
        if not path.exists():
            raise FileNotFoundError(f"File sumber tidak ditemukan: {path}")

        df = pd.read_csv(
            path,
            dtype=str,               # semua teks: zip "01037" tidak berubah jadi 1037 (Req 1.2)
            encoding="utf-8-sig",    # buang BOM di awal file jika ada (Req 1.3)
            keep_default_na=False,   # jangan ubah teks "NA"/"null"/"None" menjadi NaN...
            na_values=[""],          # ...hanya sel yang benar-benar kosong yang dianggap NaN
        )

        expected = source["columns"]
        if list(df.columns) != expected:
            missing = sorted(set(expected) - set(df.columns))
            extra = sorted(set(df.columns) - set(expected))
            raise ValueError(
                f"Kolom {source['file']} tidak sesuai. Hilang: {missing}, tidak dikenal: {extra}"
            )

        logger.info("%-22s : %9s baris  (%s)", table, f"{len(df):,}", source["file"])
        frames[table] = df
    return frames


def _get_with_retry(url: str, params: dict) -> dict:
    """GET JSON dengan retry + exponential backoff (Req 2.2, 2.3).

    Hanya error sementara (timeout, koneksi putus, HTTP 5xx) yang di-retry.
    HTTP 4xx berarti request kita salah, mencoba ulang tidak akan membantu.
    """
    for attempt in range(API_MAX_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=API_TIMEOUT_SECONDS)
            if response.status_code < 500:
                response.raise_for_status()   # 4xx → langsung error, 2xx → lanjut
                return response.json()
            error = f"HTTP {response.status_code}"
        except (requests.ConnectionError, requests.Timeout) as exc:
            error = type(exc).__name__

        if attempt == API_MAX_RETRIES:
            raise RuntimeError(f"API gagal setelah {API_MAX_RETRIES} retry ({error}): {url}")
        wait = API_BACKOFF_SECONDS * 2 ** attempt
        logger.warning("Request gagal (%s), retry %d/%d dalam %d detik",
                       error, attempt + 1, API_MAX_RETRIES, wait)
        time.sleep(wait)


def extract_exchange_rates(start: date, end: date) -> pd.DataFrame:
    """Mengambil kurs harian BASE→QUOTE. API hanya mengembalikan hari kerja."""
    url = f"{EXCHANGE_RATE_API_URL}/{start:%Y-%m-%d}..{end:%Y-%m-%d}"
    payload = _get_with_retry(url, params={"base": BASE_CURRENCY, "symbols": QUOTE_CURRENCY})

    rates = payload.get("rates", {})
    if not rates:
        raise RuntimeError(f"Respons API tidak berisi data kurs: {url}")

    df = pd.DataFrame(
        [(day, BASE_CURRENCY, QUOTE_CURRENCY, str(values[QUOTE_CURRENCY]))
         for day, values in sorted(rates.items())],
        columns=["rate_date", "base_currency", "quote_currency", "rate"],
    )
    logger.info("%-22s : %9s baris  (Frankfurter API %s..%s)",
                "exchange_rates", f"{len(df):,}", start, end)
    return df


def get_order_date_range(orders: pd.DataFrame) -> tuple[date, date]:
    """Rentang tanggal pembelian order, dimundurkan beberapa hari untuk forward fill."""
    purchase = pd.to_datetime(orders["order_purchase_timestamp"])
    start = purchase.min().date() - timedelta(days=EXCHANGE_RATE_LOOKBACK_DAYS)
    return start, purchase.max().date()


def extract_all(data_dir: Path = DATA_DIR) -> dict[str, pd.DataFrame]:
    """Entry point tahap extract: 9 CSV + 1 API = 10 DataFrame."""
    frames = extract_csv_files(data_dir)
    start, end = get_order_date_range(frames["orders"])
    frames["exchange_rates"] = extract_exchange_rates(start, end)
    return frames


if __name__ == "__main__":
    # Jalankan extract saja untuk dicoba: python -m extract.extract
    from config import setup_logging

    setup_logging()
    for name, frame in extract_all().items():
        print(f"\n=== {name} ===")
        print(frame.head(3).to_string())
