import { bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { batalkanPembelian } from '@/lib/pembelian';
import { skemaBatal } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function POST(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    const { sesi } = await requirePermission('PEMBELIAN', 'ubah');
    const { id } = await ktx.params;
    const { alasan } = skemaBatal.parse(await bacaJson(permintaan));

    await withTransaction((klien) => batalkanPembelian(klien, id, sesi.idPengguna, alasan));
    return sukses({ dibatalkan: true });
  });
}
