import { GalatAplikasi, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function GET(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('PEMBELIAN', 'lihat');
    const { id } = await ktx.params;

    const header = await querySatu(
      `SELECT pb.id_pembelian::text, pb.nomor_faktur_pembelian, pb.tanggal_pembelian,
              pm.nama_pemasok, pb.subtotal::text, pb.diskon::text, pb.pajak::text,
              pb.total_pembelian::text, pb.status_pembelian, pb.catatan, u.nama_pengguna
         FROM pembelian pb
         LEFT JOIN pemasok pm ON pm.id_pemasok = pb.id_pemasok
         JOIN pengguna u      ON u.id_pengguna = pb.id_pengguna
        WHERE pb.id_pembelian = $1`,
      [id],
    );
    if (!header) throw new GalatAplikasi(404, 'Pembelian tidak ditemukan.');

    const detail = await query(
      `SELECT d.id_detail_pembelian::text, b.kode_barang, b.nama_barang, s.kode_satuan,
              d.jumlah::text, d.harga_beli_satuan::text, d.konversi_ke_satuan_dasar::text,
              d.jumlah_satuan_dasar::text, d.subtotal::text
         FROM detail_pembelian d
         JOIN barang b ON b.id_barang = d.id_barang
         JOIN satuan s ON s.id_satuan = d.id_satuan
        WHERE d.id_pembelian = $1
        ORDER BY d.id_detail_pembelian`,
      [id],
    );

    return sukses({ header, detail });
  });
}
