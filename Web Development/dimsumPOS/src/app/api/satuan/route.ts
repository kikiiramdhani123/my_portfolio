import { bacaJson, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaSatuan } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'lihat');
    const baris = await query(
      `SELECT s.id_satuan::text, s.kode_satuan, s.nama_satuan,
              (SELECT COUNT(*) FROM satuan_barang sb WHERE sb.id_satuan = s.id_satuan)::text AS dipakai
         FROM satuan s ORDER BY s.kode_satuan`,
    );
    return sukses(baris);
  });
}

export function POST(permintaan: Request) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'tambah');
    const isi = skemaSatuan.parse(await bacaJson(permintaan));
    const baris = await querySatu<{ id_satuan: string }>(
      'INSERT INTO satuan (kode_satuan, nama_satuan) VALUES ($1,$2) RETURNING id_satuan::text',
      [isi.kodeSatuan.toUpperCase(), isi.namaSatuan],
    );
    return sukses({ idSatuan: baris!.id_satuan }, 201);
  });
}
