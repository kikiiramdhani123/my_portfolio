import { handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ idBarang: string }>;
}

/** Resep aktif satu produk (null bila belum punya resep). */
export function GET(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('RESEP', 'lihat');
    const { idBarang } = await ktx.params;

    const header = await querySatu(
      `SELECT r.id_resep::text, r.nama_resep, r.versi_resep, r.tanggal_berlaku
         FROM resep r WHERE r.id_barang_hasil = $1 AND r.status_aktif`,
      [idBarang],
    );
    if (!header) return sukses({ header: null, detail: [] });

    const detail = await query(
      `SELECT d.id_detail_resep::text, d.id_barang_bahan::text, b.kode_barang, b.nama_barang,
              d.id_satuan::text, s.kode_satuan, d.jumlah::text, d.catatan
         FROM detail_resep d
         JOIN barang b ON b.id_barang = d.id_barang_bahan
         JOIN satuan s ON s.id_satuan = d.id_satuan
        WHERE d.id_resep = (SELECT id_resep FROM resep WHERE id_barang_hasil = $1 AND status_aktif)
        ORDER BY d.id_detail_resep`,
      [idBarang],
    );

    return sukses({ header, detail });
  });
}
