import { redirect } from 'next/navigation';
import { bacaSesi } from '@/lib/auth';
import { berandaUntuk } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/** Req 1.2 — arahkan ke beranda sesuai peran. */
export default async function Beranda() {
  const sesi = await bacaSesi();
  redirect(sesi ? berandaUntuk(sesi) : '/login');
}
