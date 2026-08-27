import { redirect } from 'next/navigation';
import Link from 'next/link';
import { bacaSesi } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';

export const dynamic = 'force-dynamic';

/**
 * Lapisan keamanan kedua (Design §1): seluruh back office wajib peran OWNER.
 * Setiap API di baliknya tetap memanggil requirePermission sendiri.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sesi = await bacaSesi();
  if (!sesi) redirect('/login');

  // Req 2.3
  if (!sesi.peran.includes('OWNER')) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-4xl">🚫</span>
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="max-w-sm text-sm text-teks-lembut">
          Halaman stok dan laporan hanya dapat dibuka oleh pemilik toko.
        </p>
        <Link href="/kasir" className="text-sm font-medium text-aksen underline">
          Kembali ke halaman kasir
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh bg-latar">
      <Sidebar nama={sesi.nama} />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
