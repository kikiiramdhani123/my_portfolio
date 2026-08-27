import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaIzinPeran } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

/** Req 2.6 — ubah matriks izin; berlaku pada permintaan berikutnya tanpa redeploy. */
export function PUT(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('PENGGUNA', 'ubah');
    const { id } = await ktx.params;
    const isi = skemaIzinPeran.parse(await bacaJson(permintaan));

    await withTransaction(async (klien) => {
      const peran = await klien.satu<{ nama_peran: string }>(
        'SELECT nama_peran FROM peran WHERE id_peran = $1',
        [id],
      );
      if (!peran) throw new GalatAplikasi(404, 'Peran tidak ditemukan.');

      // Peran OWNER adalah jalan terakhir masuk ke back office — izinnya tidak boleh dilucuti.
      if (peran.nama_peran === 'OWNER') {
        throw new GalatAplikasi(409, 'Izin peran OWNER tidak dapat diubah demi keamanan sistem.');
      }

      for (const baris of isi.izin) {
        await klien.query(
          `INSERT INTO peran_hak_akses
             (id_peran, id_hak_akses, boleh_lihat, boleh_tambah, boleh_ubah, boleh_hapus)
           SELECT $1, h.id_hak_akses, $3, $4, $5, $6
             FROM hak_akses h WHERE h.kode_hak_akses = $2
           ON CONFLICT (id_peran, id_hak_akses) DO UPDATE
             SET boleh_lihat = EXCLUDED.boleh_lihat, boleh_tambah = EXCLUDED.boleh_tambah,
                 boleh_ubah  = EXCLUDED.boleh_ubah,  boleh_hapus  = EXCLUDED.boleh_hapus`,
          [id, baris.kodeHakAkses, baris.bolehLihat, baris.bolehTambah, baris.bolehUbah, baris.bolehHapus],
        );
      }
    });

    return sukses({ diubah: true });
  });
}
