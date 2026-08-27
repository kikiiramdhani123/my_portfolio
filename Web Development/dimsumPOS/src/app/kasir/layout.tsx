import { redirect } from 'next/navigation';
import Link from 'next/link';
import { bacaSesi } from '@/lib/auth';
import { muatIzin, punyaIzin } from '@/lib/rbac';
import { BilahAtas } from '@/components/kasir/BilahAtas';

export const dynamic = 'force-dynamic';

export default async function LayoutKasir({ children }: { children: React.ReactNode }) {
  const sesi = await bacaSesi();
  if (!sesi) redirect('/login');

  const izin = await muatIzin(sesi.idPengguna);
  if (!punyaIzin(izin, 'PENJUALAN', 'lihat')) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-4xl">🚫</span>
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="text-sm text-teks-lembut">Akun Anda tidak memiliki hak akses penjualan.</p>
        <Link href="/login" className="text-sm font-medium text-aksen underline">
          Masuk dengan akun lain
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-latar">
      <BilahAtas
        nama={sesi.nama}
        pemilik={sesi.peran.includes('OWNER')}
      />
      {children}
    </div>
  );
}
