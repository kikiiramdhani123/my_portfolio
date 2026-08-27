import { handler, sukses } from '@/lib/api';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daftar peran beserta matriks izinnya (Req 2.2). */
export function GET() {
  return handler(async () => {
    await requirePermission('PENGGUNA', 'lihat');

    const peran = await query(
      'SELECT id_peran::text, nama_peran FROM peran ORDER BY nama_peran',
    );
    const hakAkses = await query(
      'SELECT id_hak_akses::text, kode_hak_akses, nama_hak_akses FROM hak_akses ORDER BY id_hak_akses',
    );
    const izin = await query(
      `SELECT pha.id_peran::text, h.kode_hak_akses,
              pha.boleh_lihat, pha.boleh_tambah, pha.boleh_ubah, pha.boleh_hapus
         FROM peran_hak_akses pha
         JOIN hak_akses h ON h.id_hak_akses = pha.id_hak_akses`,
    );

    return sukses({ peran, hakAkses, izin });
  });
}
