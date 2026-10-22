import pytest

from sample_data import build_raw_sample
from transform.summary import build_summaries
from transform.transform import transform_all


@pytest.fixture
def raw_sample():
    """Dataset mini baru untuk setiap test, sehingga test boleh mengubahnya."""
    return build_raw_sample()


@pytest.fixture(scope="session")
def clean_sample():
    """Hasil transform dataset mini. Dipakai bersama: test WAJIB meng-copy sebelum mengubah."""
    return transform_all(build_raw_sample())


@pytest.fixture(scope="session")
def mart_sample(clean_sample):
    return build_summaries(clean_sample)
