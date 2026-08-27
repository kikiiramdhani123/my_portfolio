import type { NextRequest } from 'next/server';
import { bacaJson, gagal, handler, sukses } from '@/lib/api';
import { buatSesi, login } from '@/lib/auth';
import { berandaUntuk } from '@/lib/rbac';
import { skemaLogin } from '@/lib/validators';

export const runtime = 'nodejs';

export function POST(permintaan: NextRequest) {
  return handler(async () => {
    const isi = skemaLogin.parse(await bacaJson(permintaan));
    const ip = permintaan.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    const hasil = await login(isi.username, isi.kataSandi, ip);
    if (!hasil.ok) return gagal(hasil.pesan, 401);

    await buatSesi(hasil.sesi);
    return sukses({ sesi: hasil.sesi, beranda: berandaUntuk(hasil.sesi) });
  });
}
