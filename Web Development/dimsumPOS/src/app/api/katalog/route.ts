import { handler, sukses } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { ambilPengaturan, katalogJual } from '@/lib/katalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handler(async () => {
    await requirePermission('PENJUALAN', 'lihat');
    const [produk, pengaturan] = await Promise.all([katalogJual(), ambilPengaturan()]);
    return sukses({ produk, pengaturan });
  });
}
