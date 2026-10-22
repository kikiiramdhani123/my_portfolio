"""Load: koneksi ke PostgreSQL dan memuat DataFrame ke schema raw/clean/mart."""

import logging
import os

import pandas as pd
from dotenv import load_dotenv
from psycopg import sql
from sqlalchemy import Engine, create_engine, text

from config import DB_CONNECT_TIMEOUT_SECONDS, ENV_FILE

logger = logging.getLogger(__name__)

RAW_SCHEMA = "raw"


def get_engine() -> Engine:
    """Membuat SQLAlchemy engine dari DATABASE_URI di file .env (Req 11.2)."""
    load_dotenv(ENV_FILE)
    uri = os.getenv("DATABASE_URI")
    if not uri:
        raise RuntimeError(f"DATABASE_URI belum diset. Cek file {ENV_FILE}")
    # pool_pre_ping: cek koneksi masih hidup sebelum dipakai (hindari error koneksi basi)
    # connect_timeout: tanpa ini, database yang mati membuat pipeline menggantung > 4 menit
    # (timeout bawaan OS) sebelum gagal. Lebih baik gagal cepat dan jelas.
    return create_engine(uri, pool_pre_ping=True, connect_args={"connect_timeout": DB_CONNECT_TIMEOUT_SECONDS})


def check_connection(engine: Engine) -> None:
    """Memastikan database bisa dihubungi. Password tidak pernah ditulis ke log."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Terhubung ke %s", engine.url.render_as_string(hide_password=True))


def load_raw(engine: Engine, frames: dict[str, pd.DataFrame]) -> None:
    """Full refresh layer raw: TRUNCATE semua tabel lalu COPY, dalam SATU transaksi (Req 3, 9.3).

    Kenapa COPY, bukan to_sql? COPY mengalirkan data ke PostgreSQL sebagai satu stream,
    jauh lebih cepat daripada ribuan INSERT. Ini penting untuk 1 juta baris geolocation.

    Kenapa satu transaksi? Jika COPY tabel ke-7 gagal, TRUNCATE dan COPY tabel 1-6 ikut
    dibatalkan, jadi isi raw kembali ke kondisi sebelum run, bukan kosong separuh.
    """
    tables = sql.SQL(", ").join(sql.Identifier(RAW_SCHEMA, t) for t in frames)

    # engine.begin(): COMMIT otomatis jika blok selesai, ROLLBACK jika ada exception
    with engine.begin() as conn:
        # COPY adalah fitur khusus driver, jadi kita turun ke koneksi psycopg di bawah SQLAlchemy
        with conn.connection.dbapi_connection.cursor() as cur:
            cur.execute(sql.SQL("TRUNCATE {}").format(tables))

            for table, df in frames.items():
                # Kolom _loaded_at tidak disebut → terisi DEFAULT now(). now() di PostgreSQL =
                # waktu mulai transaksi, jadi semua baris dari satu run punya timestamp yang sama.
                copy_stmt = sql.SQL("COPY {} ({}) FROM STDIN").format(
                    sql.Identifier(RAW_SCHEMA, table),
                    sql.SQL(", ").join(map(sql.Identifier, df.columns)),
                )
                # NaN pandas → None, supaya tersimpan sebagai NULL (bukan teks 'NaN')
                rows = df.astype(object).where(df.notna(), None).itertuples(index=False, name=None)
                with cur.copy(copy_stmt) as copy:
                    for row in rows:
                        copy.write_row(row)

                # Verifikasi langsung: jumlah baris yang masuk harus sama dengan sumber (Req 3.1)
                if cur.rowcount != len(df):
                    raise RuntimeError(
                        f"{RAW_SCHEMA}.{table}: {cur.rowcount} baris masuk, sumber {len(df)} baris"
                    )
                logger.info("%s.%-20s : %9s baris", RAW_SCHEMA, table, f"{cur.rowcount:,}")


def load_tables(engine: Engine, schema: str, frames: dict[str, pd.DataFrame], order: list[str]) -> None:
    """Full refresh layer clean/mart: TRUNCATE lalu INSERT sesuai urutan FK, dalam SATU transaksi (Req 9).

    - TRUNCATE semua tabel dalam satu statement, TANPA CASCADE: CASCADE akan ikut mengosongkan tabel
      lain di luar daftar yang punya FK ke sini secara diam-diam. Tanpa CASCADE, PostgreSQL menolak
      dengan error yang jelas jika ada tabel seperti itu.
    - if_exists="append": tabel sudah dibuat oleh DDL. "replace" akan men-DROP tabel beserta
      PK/FK/CHECK-nya lalu membuat ulang tabel versi tebakan pandas.
    - Urutan insert induk → anak (Req 9.2), karena FK diperiksa saat setiap baris masuk.
    """
    if set(frames) != set(order):
        raise ValueError(f"Tabel {schema} tidak lengkap/berlebih: {sorted(set(frames) ^ set(order))}")

    quote = engine.dialect.identifier_preparer.quote
    qualified = {table: f"{quote(schema)}.{quote(table)}" for table in order}

    with engine.begin() as conn:
        conn.exec_driver_sql(f"TRUNCATE {', '.join(qualified.values())}")
        for table in order:
            df = frames[table]
            df.to_sql(table, conn, schema=schema, if_exists="append", index=False, chunksize=10_000)

            # Verifikasi dari sisi database, bukan dari return value to_sql
            loaded = conn.execute(text(f"SELECT COUNT(*) FROM {qualified[table]}")).scalar_one()
            if loaded != len(df):
                raise RuntimeError(f"{schema}.{table}: {loaded} baris masuk, DataFrame {len(df)} baris")
            logger.info("%s.%-20s : %9s baris", schema, table, f"{loaded:,}")


if __name__ == "__main__":
    # Tes koneksi (Task 3.3) + verifikasi tabel hasil Task 2: python -m load.load
    from config import setup_logging

    setup_logging()
    engine = get_engine()
    check_connection(engine)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT table_schema, COUNT(*)
            FROM information_schema.tables
            WHERE table_schema IN ('raw', 'clean', 'mart')
            GROUP BY table_schema
            ORDER BY table_schema
        """)).all()
    for schema, total in rows:
        logger.info("schema %-5s : %d tabel", schema, total)
