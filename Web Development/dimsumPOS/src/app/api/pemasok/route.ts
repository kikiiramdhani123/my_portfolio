import { bacaJson, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaPemasok } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handler(async () => {
    await requirePermission('MASTER_PEMASOK', 'lihat');
    const baris = await query(
      `SELECT id_pemasok::text, kode_pemasok, nama_pemasok, nomor_telepon, alamat, status_aktif
         FROM pemasok ORDER BY nama_pemasok`,
    );
    return sukses(baris);
  });
}

export function POST(permintaan: Request) {
  return handler(async () => {
    await requirePermission('MASTER_PEMASOK', 'tambah');
    const isi = skemaPemasok.parse(await bacaJson(permintaan));
    const baris = await querySatu<{ id_pemasok: string }>(
      `INSERT INTO pemasok (kode_pemasok, nama_pemasok, nomor_telepon, alamat, status_aktif)
       VALUES ($1,$2,$3,$4,$5) RETURNING id_pemasok::text`,
      [isi.kodePemasok, isi.namaPemasok, isi.nomorTelepon ?? null, isi.alamat ?? null, isi.statusAktif],
    );
    return sukses({ idPemasok: baris!.id_pemasok }, 201);
  });
}
