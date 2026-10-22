"""Requirement 1 & 2: extract CSV dan API (tanpa internet: requests di-mock)."""

from datetime import date

import pandas as pd
import pytest
import requests

import extract.extract as extract

SOURCE = {"places": {"file": "places.csv", "columns": ["zip", "city", "note"]}}


@pytest.fixture
def one_source(monkeypatch):
    monkeypatch.setattr(extract, "CSV_SOURCES", SOURCE)


def write_csv(path, text, bom=False):
    path.write_text(("﻿" if bom else "") + text, encoding="utf-8")


# ---------- CSV ---------------------------------------------------------------

def test_csv_read_as_text_without_changing_values(tmp_path, one_source):
    write_csv(tmp_path / "places.csv", "zip,city,note\n01037,sao paulo,NA\n13023,campinas,\n", bom=True)
    df = extract.extract_csv_files(tmp_path)["places"]

    assert list(df.columns) == ["zip", "city", "note"]   # Req 1.3: BOM tidak menempel di nama kolom
    assert df.loc[0, "zip"] == "01037"                    # Req 1.2: nol di depan tidak hilang
    assert df.loc[0, "note"] == "NA"                      # teks "NA" tetap teks, bukan NaN
    assert pd.isna(df.loc[1, "note"])                     # hanya sel kosong yang menjadi NaN


def test_missing_file_names_the_file(tmp_path, one_source):
    with pytest.raises(FileNotFoundError, match="places.csv"):   # Req 1.4
        extract.extract_csv_files(tmp_path)


def test_unexpected_columns_name_the_file_and_columns(tmp_path, one_source):
    write_csv(tmp_path / "places.csv", "zip,kota,note\n01037,sao paulo,x\n")
    with pytest.raises(ValueError, match=r"places\.csv.*city.*kota"):   # Req 1.4
        extract.extract_csv_files(tmp_path)


# ---------- API: retry ----------------------------------------------------------

class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


@pytest.fixture
def fake_api(monkeypatch):
    """Mengganti requests.get dengan daftar respons berurutan; time.sleep dicatat, tidak benar-benar tidur."""
    state = {"responses": [], "calls": 0, "sleeps": []}

    def fake_get(url, params, timeout):
        response = state["responses"][state["calls"]]
        state["calls"] += 1
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(extract.requests, "get", fake_get)
    monkeypatch.setattr(extract.time, "sleep", state["sleeps"].append)
    return state


def test_retry_until_success_with_backoff(fake_api):
    fake_api["responses"] = [requests.ConnectionError(), requests.Timeout(), FakeResponse(200, {"ok": 1})]
    assert extract._get_with_retry("http://api", {}) == {"ok": 1}
    assert fake_api["sleeps"] == [2, 4]                  # Req 2.2: jeda bertambah


def test_gives_up_after_three_retries(fake_api):
    fake_api["responses"] = [FakeResponse(503)] * 4
    with pytest.raises(RuntimeError, match="3 retry"):   # Req 2.3
        extract._get_with_retry("http://api", {})
    assert fake_api["calls"] == 4 and fake_api["sleeps"] == [2, 4, 8]


def test_client_error_is_not_retried(fake_api):
    fake_api["responses"] = [FakeResponse(404)]
    with pytest.raises(requests.HTTPError):
        extract._get_with_retry("http://api", {})
    assert fake_api["calls"] == 1 and fake_api["sleeps"] == []


def test_exchange_rates_parsed_sorted_as_text(fake_api):
    fake_api["responses"] = [FakeResponse(200, {"rates": {"2018-01-05": {"USD": 0.31}, "2018-01-04": {"USD": 0.3}}})]
    df = extract.extract_exchange_rates(date(2018, 1, 4), date(2018, 1, 5))
    assert df["rate_date"].tolist() == ["2018-01-04", "2018-01-05"]
    assert df["rate"].tolist() == ["0.3", "0.31"]


def test_exchange_rate_range_starts_before_first_order():
    orders = pd.DataFrame({"order_purchase_timestamp": ["2016-09-04 21:15:19", "2018-10-17 17:30:18"]})
    assert extract.get_order_date_range(orders) == (date(2016, 8, 28), date(2018, 10, 17))
