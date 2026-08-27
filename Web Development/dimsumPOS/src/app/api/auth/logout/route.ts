import { handler, sukses } from '@/lib/api';
import { hapusSesi } from '@/lib/auth';

export const runtime = 'nodejs';

export function POST() {
  return handler(async () => {
    await hapusSesi();
    return sukses({ keluar: true });
  });
}
