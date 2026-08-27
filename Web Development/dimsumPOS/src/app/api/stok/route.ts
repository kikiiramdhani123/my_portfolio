import type { NextRequest } from 'next/server';
import { handler, sukses } from '@/lib/api';
import { klienPool } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { ringkasanStok } from '@/lib/stok';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(permintaan: NextRequest) {
  return handler(async () => {
    await requirePermission('STOK', 'lihat');
    const cari = permintaan.nextUrl.searchParams.get('cari') ?? undefined;
    return sukses(await ringkasanStok(klienPool, cari));
  });
}
