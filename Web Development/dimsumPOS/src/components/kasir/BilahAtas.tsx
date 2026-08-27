'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tombol, gabung } from '@/components/ui/dasar';
import { api } from '@/lib/klien';

/** Bilah atas layar kasir: identitas, status jaringan (Req 10.4), navigasi, keluar. */
export function BilahAtas({ nama, pemilik }: { nama: string; pemilik: boolean }) {
  const router = useRouter();
  const jalur = usePathname();
  const [daring, setDaring] = useState(true);

  useEffect(() => {
    const perbarui = () => setDaring(navigator.onLine);
    perbarui();
    window.addEventListener('online', perbarui);
    window.addEventListener('offline', perbarui);
    return () => {
      window.removeEventListener('online', perbarui);
      window.removeEventListener('offline', perbarui);
    };
  }, []);

  async function keluar() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  const tautan = [
    { href: '/kasir', label: 'Kasir' },
    { href: '/kasir/riwayat', label: 'Riwayat' },
  ];

  return (
    <header className="tanpa-cetak sticky top-0 z-30 flex items-center gap-3 border-b border-garis bg-permukaan px-3 py-2">
      <span className="text-xl">🥟</span>

      <nav className="flex gap-1">
        {tautan.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={gabung(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              jalur === t.href ? 'bg-aksen-lembut text-aksen-kuat' : 'text-teks-lembut hover:bg-permukaan-2',
            )}
          >
            {t.label}
          </Link>
        ))}
        {pemilik && (
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-teks-lembut hover:bg-permukaan-2"
          >
            Back Office
          </Link>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={gabung(
            'hidden items-center gap-1.5 text-xs font-medium sm:flex',
            daring ? 'text-sukses' : 'text-bahaya',
          )}
        >
          <span className={gabung('h-2 w-2 rounded-full', daring ? 'bg-sukses' : 'bg-bahaya')} />
          {daring ? 'Online' : 'Offline'}
        </span>
        <span className="hidden text-sm text-teks-lembut sm:inline">{nama}</span>
        <Tombol varian="hantu" kecil onClick={keluar}>Keluar</Tombol>
      </div>
    </header>
  );
}
