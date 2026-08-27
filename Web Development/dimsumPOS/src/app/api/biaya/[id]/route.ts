import { handler, sukses } from '@/lib/api';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

export function DELETE(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('BIAYA', 'hapus');
    const { id } = await ktx.params;
    await query('DELETE FROM biaya_operasional WHERE id_biaya = $1', [id]);
    return sukses({ dihapus: true });
  });
}
