import { bacaJson, handler, sukses } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { simpanResep } from '@/lib/resep';
import { skemaResep } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daftar resep aktif beserta jumlah bahannya. */
export function GET() {
  return handler(async () => {
    await requirePermission('RESEP', 'lihat');
    const baris = await query(
      `SELECT r.id_resep::text, r.nama_resep, r.versi_resep, r.tanggal_berlaku, r.status_aktif,
              b.id_barang::text AS id_barang_hasil, b.kode_barang, b.nama_barang,
              (SELECT COUNT(*) FROM detail_resep d WHERE d.id_resep = r.id_resep)::text AS jumlah_bahan
         FROM resep r
         JOIN barang b ON b.id_barang = r.id_barang_hasil
        WHERE r.status_aktif
        ORDER BY b.nama_barang`,
    );
    return sukses(baris);
  });
}

export function POST(permintaan: Request) {
  return handler(async () => {
    await requirePermission('RESEP', 'tambah');
    const isi = skemaResep.parse(await bacaJson(permintaan));
    const idResep = await withTransaction((klien) => simpanResep(klien, isi));
    return sukses({ idResep }, 201);
  });
}
