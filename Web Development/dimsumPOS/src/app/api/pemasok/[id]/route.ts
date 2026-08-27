import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaPemasok } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function PUT(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_PEMASOK', 'ubah');
    const { id } = await ktx.params;
    const isi = skemaPemasok.parse(await bacaJson(permintaan));
    await query(
      `UPDATE pemasok SET kode_pemasok=$2, nama_pemasok=$3, nomor_telepon=$4,
                          alamat=$5, status_aktif=$6
        WHERE id_pemasok=$1`,
      [id, isi.kodePemasok, isi.namaPemasok, isi.nomorTelepon ?? null, isi.alamat ?? null, isi.statusAktif],
    );
    return sukses({ diubah: true });
  });
}

export function DELETE(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_PEMASOK', 'hapus');
    const { id } = await ktx.params;
    const dipakai = await querySatu<{ jumlah: string }>(
      'SELECT COUNT(*)::text AS jumlah FROM pembelian WHERE id_pemasok = $1',
      [id],
    );
    if (Number(dipakai?.jumlah ?? '0') > 0) {
      throw new GalatAplikasi(409, 'Pemasok sudah dipakai pada pembelian. Nonaktifkan saja.');
    }
    await query('DELETE FROM pemasok WHERE id_pemasok = $1', [id]);
    return sukses({ dihapus: true });
  });
}
