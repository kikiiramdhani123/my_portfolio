-- 002_trigger.sql — jaga integritas: kartu stok append-only + updated_at otomatis
-- Requirement: 7.3, 11.1

-- Req 7.3 — pergerakan_stok tidak boleh diubah atau dihapus
CREATE OR REPLACE FUNCTION cegah_ubah_pergerakan() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pergerakan_stok bersifat append-only: koreksi harus lewat pergerakan pembalik';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cegah_ubah_pergerakan
  BEFORE UPDATE OR DELETE ON pergerakan_stok
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_pergerakan();

-- Req 11.1 — updated_at otomatis pada tabel master
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pengguna_updated_at  BEFORE UPDATE ON pengguna
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_barang_updated_at    BEFORE UPDATE ON barang
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pembelian_updated_at BEFORE UPDATE ON pembelian
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
