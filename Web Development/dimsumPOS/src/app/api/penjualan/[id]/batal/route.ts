import { bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { batalkanPenjualan } from '@/lib/penjualan';
import { skemaBatal } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

/** Req 6.13 — pembatalan butuh hak PENJUALAN_BATAL dan mengembalikan stok. */
export function POST(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    const { sesi } = await requirePermission('PENJUALAN_BATAL', 'ubah');
    const { id } = await ktx.params;
    const { alasan } = skemaBatal.parse(await bacaJson(permintaan));

    await withTransaction((klien) => batalkanPenjualan(klien, id, sesi.idPengguna, alasan));
    return sukses({ dibatalkan: true });
  });
}
