import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction, type Klien } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { hashSandi } from '@/lib/auth';
import { skemaPengguna } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function PUT(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('PENGGUNA', 'ubah');
    const { id } = await ktx.params;
    const isi = skemaPengguna.parse(await bacaJson(permintaan));

    await withTransaction(async (klien) => {
      const hash = isi.kataSandi ? await hashSandi(isi.kataSandi) : null;
      await klien.query(
        `UPDATE pengguna
            SET nama_pengguna = $2, username = $3, status_aktif = $4,
                kata_sandi_hash = COALESCE($5, kata_sandi_hash)
          WHERE id_pengguna = $1`,
        [id, isi.namaPengguna, isi.username, isi.statusAktif, hash],
      );

      await klien.query('DELETE FROM pengguna_peran WHERE id_pengguna = $1', [id]);
      for (const namaPeran of isi.peran) {
        await klien.query(
          `INSERT INTO pengguna_peran (id_pengguna, id_peran)
           SELECT $1, id_peran FROM peran WHERE nama_peran = $2`,
          [id, namaPeran],
        );
      }

      await pastikanAdaOwnerAktif(klien);
    });

    return sukses({ diubah: true });
  });
}

/** Req 2.7 — minimal satu pemilik aktif harus tetap ada. */
async function pastikanAdaOwnerAktif(klien: Klien): Promise<void> {
  const baris = await klien.satu<{ jumlah: string }>(
    `SELECT COUNT(*)::text AS jumlah
       FROM pengguna u
       JOIN pengguna_peran pp ON pp.id_pengguna = u.id_pengguna
       JOIN peran p           ON p.id_peran = pp.id_peran
      WHERE p.nama_peran = 'OWNER' AND u.status_aktif`,
  );
  if (Number(baris?.jumlah ?? '0') === 0) {
    throw new GalatAplikasi(409, 'Minimal satu pemilik aktif harus ada.');
  }
}
