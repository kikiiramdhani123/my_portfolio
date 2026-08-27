import type { PoolClient } from 'pg';

/**
 * Data pondasi yang dipakai bersama oleh `seed.ts` (mode contoh) dan
 * `seed-kosong.ts` (mode kosong) — wajib ada di kedua mode karena RBAC
 * (Requirement 2.1, 2.2) tidak berfungsi tanpanya.
 */

export const HAK_AKSES: ReadonlyArray<[string, string]> = [
  ['DASBOR', 'Dasbor pemilik'],
  ['MASTER_BARANG', 'Master barang & satuan'],
  ['MASTER_PEMASOK', 'Master pemasok'],
  ['PEMBELIAN', 'Pembelian / barang masuk'],
  ['RESEP', 'Resep / komposisi produk'],
  ['STOK', 'Kartu stok & penyesuaian'],
  ['BIAYA', 'Biaya operasional'],
  ['LAPORAN_LABA', 'Laporan laba & HPP'],
  ['PENJUALAN', 'Transaksi penjualan'],
  ['PENJUALAN_BATAL', 'Pembatalan transaksi'],
  ['PENGGUNA', 'Kelola pengguna & hak akses'],
];

/** Matriks izin — Design §4. KASIR hanya boleh lihat & tambah PENJUALAN. */
export const IZIN: Record<string, Record<string, [boolean, boolean, boolean, boolean]>> = {
  OWNER: Object.fromEntries(HAK_AKSES.map(([kode]) => [kode, [true, true, true, true]])),
  KASIR: { PENJUALAN: [true, true, false, false] },
};

export async function seedHakAkses(k: PoolClient): Promise<void> {
  for (const [kode, nama] of HAK_AKSES) {
    await k.query(
      `INSERT INTO hak_akses (kode_hak_akses, nama_hak_akses) VALUES ($1,$2)
       ON CONFLICT (kode_hak_akses) DO UPDATE SET nama_hak_akses = EXCLUDED.nama_hak_akses`,
      [kode, nama],
    );
  }
  console.log(`→ hak akses: ${HAK_AKSES.length}`);
}

export async function seedPeranIzin(k: PoolClient): Promise<void> {
  for (const namaPeran of Object.keys(IZIN)) {
    await k.query(
      `INSERT INTO peran (nama_peran) VALUES ($1) ON CONFLICT (nama_peran) DO NOTHING`,
      [namaPeran],
    );
    for (const [kodeHak, [l, t, u, h]] of Object.entries(IZIN[namaPeran]!)) {
      await k.query(
        `INSERT INTO peran_hak_akses
           (id_peran, id_hak_akses, boleh_lihat, boleh_tambah, boleh_ubah, boleh_hapus)
         SELECT p.id_peran, h.id_hak_akses, $3, $4, $5, $6
           FROM peran p, hak_akses h
          WHERE p.nama_peran = $1 AND h.kode_hak_akses = $2
         ON CONFLICT (id_peran, id_hak_akses) DO UPDATE
           SET boleh_lihat = EXCLUDED.boleh_lihat, boleh_tambah = EXCLUDED.boleh_tambah,
               boleh_ubah  = EXCLUDED.boleh_ubah,  boleh_hapus  = EXCLUDED.boleh_hapus`,
        [namaPeran, kodeHak, l, t, u, h],
      );
    }
  }
  console.log(`→ peran: ${Object.keys(IZIN).join(', ')}`);
}
