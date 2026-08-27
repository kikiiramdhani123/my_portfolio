import { query } from './db';

/** Katalog layar kasir — Requirement 3.7, 6.1, 6.11 (tanpa HPP / harga beli). */

interface SatuanJual {
  idSatuanBarang: string;
  idSatuan: string;
  kodeSatuan: string;
  konversi: string;
  hargaJual: string;
  barcode: string | null;
  utama: boolean;
}

interface ProdukKatalog {
  idBarang: string;
  kodeBarang: string;
  namaBarang: string;
  jenisBarang: string;
  emoji: string | null;
  warnaKartu: string | null;
  satuan: SatuanJual[];
}

interface BarisKatalog {
  id_barang: string;
  kode_barang: string;
  nama_barang: string;
  jenis_barang: string;
  emoji: string | null;
  warna_kartu: string | null;
  id_satuan_barang: string;
  id_satuan: string;
  kode_satuan: string;
  konversi_ke_satuan_dasar: string;
  harga_jual: string;
  barcode: string | null;
  adalah_satuan_default: boolean;
}

export async function katalogJual(): Promise<ProdukKatalog[]> {
  const baris = await query<BarisKatalog>(
    `SELECT b.id_barang::text, b.kode_barang, b.nama_barang, b.jenis_barang,
            b.emoji, b.warna_kartu,
            sb.id_satuan_barang::text, sb.id_satuan::text, s.kode_satuan,
            sb.konversi_ke_satuan_dasar::text, sb.harga_jual::text,
            sb.barcode, sb.adalah_satuan_default
       FROM barang b
       JOIN satuan_barang sb ON sb.id_barang = b.id_barang
       JOIN satuan s         ON s.id_satuan = sb.id_satuan
      WHERE b.dapat_dijual AND b.status_aktif
        -- harga_jual boleh Rp0: dipakai untuk "produk kemasan" yang hanya
        -- menghabiskan stok kemasan tanpa menambah nilai transaksi (lihat Req 5)
      ORDER BY b.jenis_barang, b.nama_barang, sb.adalah_satuan_default DESC`,
  );

  const peta = new Map<string, ProdukKatalog>();
  for (const b of baris) {
    let produk = peta.get(b.id_barang);
    if (!produk) {
      produk = {
        idBarang: b.id_barang,
        kodeBarang: b.kode_barang,
        namaBarang: b.nama_barang,
        jenisBarang: b.jenis_barang,
        emoji: b.emoji,
        warnaKartu: b.warna_kartu,
        satuan: [],
      };
      peta.set(b.id_barang, produk);
    }
    produk.satuan.push({
      idSatuanBarang: b.id_satuan_barang,
      idSatuan: b.id_satuan,
      kodeSatuan: b.kode_satuan,
      konversi: b.konversi_ke_satuan_dasar,
      hargaJual: b.harga_jual,
      barcode: b.barcode,
      utama: b.adalah_satuan_default,
    });
  }
  return [...peta.values()];
}

export async function ambilPengaturan(): Promise<Record<string, string>> {
  const baris = await query<{ kunci: string; nilai: string }>('SELECT kunci, nilai FROM pengaturan');
  return Object.fromEntries(baris.map((b) => [b.kunci, b.nilai]));
}
