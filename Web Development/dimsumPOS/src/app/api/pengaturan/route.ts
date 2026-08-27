import { bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { ambilPengaturan } from '@/lib/katalog';
import { skemaPengaturan } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handler(async () => {
    await requirePermission('DASBOR', 'lihat');
    return sukses(await ambilPengaturan());
  });
}

export function PUT(permintaan: Request) {
  return handler(async () => {
    await requirePermission('DASBOR', 'ubah');
    const isi = skemaPengaturan.parse(await bacaJson(permintaan));

    await withTransaction(async (klien) => {
      for (const [kunci, nilai] of Object.entries(isi.nilai)) {
        await klien.query(
          `INSERT INTO pengaturan (kunci, nilai) VALUES ($1,$2)
           ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai`,
          [kunci, nilai],
        );
      }
    });

    return sukses({ disimpan: true });
  });
}
