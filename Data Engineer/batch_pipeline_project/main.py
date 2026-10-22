"""Orkestrator pipeline Olist: extract → load raw → transform → load clean → summary → load mart.

Jalankan dari root project: python main.py
Exit code 0 = sukses, 1 = gagal (Req 11.4). Scheduler (cron, Airflow, Task Scheduler) membaca
exit code ini untuk menentukan apakah job berhasil, bukan membaca log.
"""

import logging
import sys
import time
from collections.abc import Callable
from typing import Any

from config import CLEAN_LOAD_ORDER, MART_LOAD_ORDER, setup_logging
from extract.extract import extract_all
from load.load import check_connection, get_engine, load_raw, load_tables
from transform.quality import DataQualityError
from transform.summary import build_summaries
from transform.transform import transform_all

logger = logging.getLogger("pipeline")


class StageTimer:
    """Menjalankan satu tahap pipeline sambil mencatat durasinya (Req 11.3)."""

    def __init__(self) -> None:
        self.durations: dict[str, float] = {}

    def run(self, name: str, func: Callable[..., Any], *args: Any) -> Any:
        logger.info("=== [%d] %s ===", len(self.durations) + 1, name)
        start = time.perf_counter()
        try:
            return func(*args)
        finally:
            # finally: durasi tetap tercatat walaupun tahap ini gagal
            self.durations[name] = time.perf_counter() - start
            logger.info("--- %s: %.1f detik", name, self.durations[name])


def _total_rows(frames: dict) -> int:
    return sum(len(df) for df in frames.values())


def run_pipeline(timer: StageTimer) -> dict[str, int]:
    """Seluruh tahap secara berurutan (Req 11.1). Return: jumlah baris per layer."""
    engine = get_engine()
    timer.run("Cek koneksi database", check_connection, engine)   # gagal cepat sebelum membaca CSV

    raw = timer.run("Extract (CSV + API)", extract_all)
    timer.run("Load raw", load_raw, engine, raw)
    clean = timer.run("Transform + quality check clean", transform_all, raw)
    timer.run("Load clean", load_tables, engine, "clean", clean, CLEAN_LOAD_ORDER)
    mart = timer.run("Summary + rekonsiliasi mart", build_summaries, clean)
    timer.run("Load mart", load_tables, engine, "mart", mart, MART_LOAD_ORDER)
    return {"raw": _total_rows(raw), "clean": _total_rows(clean), "mart": _total_rows(mart)}


def main() -> int:
    setup_logging()
    timer = StageTimer()
    started = time.perf_counter()
    logger.info("Pipeline Olist dimulai")

    try:
        rows = run_pipeline(timer)
    except DataQualityError as exc:
        # Gagal yang "diharapkan": data melanggar aturan. Detail pelanggaran sudah ada di log quality.
        logger.error("Pipeline DIHENTIKAN oleh data quality check: %s", exc)
        logger.error("Layer yang belum di-load tidak berubah (isi run sebelumnya tetap utuh).")
        return 1
    except Exception:
        # Gagal yang tidak diharapkan: tampilkan traceback lengkap untuk debugging.
        logger.exception("Pipeline GAGAL di tahap '%s'", list(timer.durations)[-1] if timer.durations else "setup")
        return 1

    logger.info("=" * 60)
    logger.info("RINGKASAN RUN")
    for name, seconds in timer.durations.items():
        logger.info("  %-35s %7.1f detik", name, seconds)
    logger.info("  %-35s %7.1f detik", "TOTAL", time.perf_counter() - started)
    logger.info("  Baris dimuat: raw %s | clean %s | mart %s",
                f"{rows['raw']:,}", f"{rows['clean']:,}", f"{rows['mart']:,}")
    logger.info("Pipeline SUKSES")
    return 0


if __name__ == "__main__":
    sys.exit(main())
