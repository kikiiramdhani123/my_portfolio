import { GalatAplikasi, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string; idSatuanBarang: string }>;
}

export function DELETE(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'hapus');
    const { id, idSatuanBarang } = await ktx.params;

    const baris = await querySatu<{ adalah_satuan_default: boolean; id_satuan: string }>(
      `SELECT adalah_satuan_default, id_satuan::text
         FROM satuan_barang WHERE id_satuan_barang = $1 AND id_barang = $2`,
      [idSatuanBarang, id],
    );
    if (!baris) throw new GalatAplikasi(404, 'Satuan barang tidak ditemukan.');
    if (baris.adalah_satuan_default) {
      throw new GalatAplikasi(409, 'Satuan dasar tidak dapat dihapus.');
    }

    const dipakai = await querySatu<{ jumlah: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM detail_penjualan WHERE id_barang = $1 AND id_satuan = $2) +
         (SELECT COUNT(*) FROM detail_pembelian WHERE id_barang = $1 AND id_satuan = $2)
       )::text AS jumlah`,
      [id, baris.id_satuan],
    );
    if (Number(dipakai?.jumlah ?? '0') > 0) {
      throw new GalatAplikasi(409, 'Satuan ini sudah dipakai pada transaksi dan tidak dapat dihapus.');
    }

    await query('DELETE FROM satuan_barang WHERE id_satuan_barang = $1', [idSatuanBarang]);
    return sukses({ dihapus: true });
  });
}
