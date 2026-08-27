import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { query, querySatu, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaBarang } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function GET(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'lihat');
    const { id } = await ktx.params;

    const barang = await querySatu(
      `SELECT b.id_barang::text, b.kode_barang, b.nama_barang, b.jenis_barang,
              b.id_satuan_dasar::text, b.dapat_dijual, b.dapat_dibeli, b.status_aktif,
              b.stok_minimum::text, b.emoji, b.warna_kartu
         FROM barang b WHERE b.id_barang = $1`,
      [id],
    );
    if (!barang) throw new GalatAplikasi(404, 'Barang tidak ditemukan.');

    const satuan = await query(
      `SELECT sb.id_satuan_barang::text, sb.id_satuan::text, s.kode_satuan, s.nama_satuan,
              sb.konversi_ke_satuan_dasar::text, sb.harga_jual::text, sb.barcode,
              sb.adalah_satuan_default
         FROM satuan_barang sb JOIN satuan s ON s.id_satuan = sb.id_satuan
        WHERE sb.id_barang = $1
        ORDER BY sb.adalah_satuan_default DESC, sb.konversi_ke_satuan_dasar`,
      [id],
    );

    return sukses({ barang, satuan });
  });
}

export function PUT(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'ubah');
    const { id } = await ktx.params;
    const isi = skemaBarang.parse(await bacaJson(permintaan));

    await withTransaction(async (klien) => {
      const ada = await klien.satu<{ id_satuan_dasar: string }>(
        'SELECT id_satuan_dasar::text FROM barang WHERE id_barang = $1',
        [id],
      );
      if (!ada) throw new GalatAplikasi(404, 'Barang tidak ditemukan.');

      // Satuan dasar tidak boleh berubah setelah ada pergerakan stok — seluruh
      // riwayat kartu stok memakai satuan dasar lama.
      if (ada.id_satuan_dasar !== isi.idSatuanDasar) {
        const dipakai = await klien.satu<{ ada: string }>(
          'SELECT COUNT(*)::text AS ada FROM pergerakan_stok WHERE id_barang = $1',
          [id],
        );
        if (Number(dipakai?.ada ?? '0') > 0) {
          throw new GalatAplikasi(409, 'Satuan dasar tidak dapat diubah karena barang sudah punya riwayat stok.');
        }
      }

      await klien.query(
        `UPDATE barang
            SET kode_barang = $2, nama_barang = $3, jenis_barang = $4, id_satuan_dasar = $5,
                dapat_dijual = $6, dapat_dibeli = $7, status_aktif = $8, stok_minimum = $9,
                emoji = $10, warna_kartu = $11
          WHERE id_barang = $1`,
        [id, isi.kodeBarang, isi.namaBarang, isi.jenisBarang, isi.idSatuanDasar,
         isi.dapatDijual, isi.dapatDibeli, isi.statusAktif, isi.stokMinimum,
         isi.emoji ?? null, isi.warnaKartu ?? null],
      );

      await klien.query(
        `INSERT INTO satuan_barang
           (id_barang, id_satuan, konversi_ke_satuan_dasar, harga_jual, adalah_satuan_default)
         VALUES ($1,$2,1,$3,TRUE)
         ON CONFLICT (id_barang, id_satuan) DO UPDATE SET harga_jual = EXCLUDED.harga_jual`,
        [id, isi.idSatuanDasar, isi.hargaJual],
      );
    });

    return sukses({ diubah: true });
  });
}

/** Req 3.6 — tolak hapus bila sudah dipakai transaksi; sarankan nonaktifkan. */
export function DELETE(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'hapus');
    const { id } = await ktx.params;

    const dipakai = await querySatu<{ jumlah: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM detail_penjualan WHERE id_barang = $1) +
         (SELECT COUNT(*) FROM detail_pembelian WHERE id_barang = $1) +
         (SELECT COUNT(*) FROM pergerakan_stok  WHERE id_barang = $1) +
         (SELECT COUNT(*) FROM detail_resep     WHERE id_barang_bahan = $1)
       )::text AS jumlah`,
      [id],
    );

    if (Number(dipakai?.jumlah ?? '0') > 0) {
      throw new GalatAplikasi(
        409,
        'Barang sudah dipakai pada transaksi atau resep. Nonaktifkan barang alih-alih menghapusnya.',
      );
    }

    await query('DELETE FROM barang WHERE id_barang = $1', [id]);
    return sukses({ dihapus: true });
  });
}
