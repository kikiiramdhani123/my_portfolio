import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { hashSandi } from '@/lib/auth';
import { skemaPengguna } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handler(async () => {
    await requirePermission('PENGGUNA', 'lihat');
    const baris = await query(
      `SELECT u.id_pengguna::text, u.nama_pengguna, u.username, u.status_aktif, u.created_at,
              COALESCE(array_agg(p.nama_peran) FILTER (WHERE p.nama_peran IS NOT NULL), '{}') AS peran
         FROM pengguna u
         LEFT JOIN pengguna_peran pp ON pp.id_pengguna = u.id_pengguna
         LEFT JOIN peran p           ON p.id_peran = pp.id_peran
        GROUP BY u.id_pengguna
        ORDER BY u.nama_pengguna`,
    );
    return sukses(baris);
  });
}

export function POST(permintaan: Request) {
  return handler(async () => {
    await requirePermission('PENGGUNA', 'tambah');
    const isi = skemaPengguna.parse(await bacaJson(permintaan));
    if (!isi.kataSandi) throw new GalatAplikasi(422, 'Kata sandi wajib diisi untuk pengguna baru.');

    const hash = await hashSandi(isi.kataSandi);
    const id = await withTransaction(async (klien) => {
      const baris = await klien.satu<{ id_pengguna: string }>(
        `INSERT INTO pengguna (nama_pengguna, username, kata_sandi_hash, status_aktif)
         VALUES ($1,$2,$3,$4) RETURNING id_pengguna::text`,
        [isi.namaPengguna, isi.username, hash, isi.statusAktif],
      );
      for (const namaPeran of isi.peran) {
        await klien.query(
          `INSERT INTO pengguna_peran (id_pengguna, id_peran)
           SELECT $1, id_peran FROM peran WHERE nama_peran = $2`,
          [baris!.id_pengguna, namaPeran],
        );
      }
      return baris!.id_pengguna;
    });

    return sukses({ idPengguna: id }, 201);
  });
}
