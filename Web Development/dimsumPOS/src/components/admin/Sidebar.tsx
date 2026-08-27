'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { gabung } from '@/components/ui/dasar';
import { api } from '@/lib/klien';

const MENU = [
  { href: '/admin', label: 'Dasbor', ikon: '📊' },
  { href: '/admin/barang', label: 'Barang', ikon: '📦' },
  { href: '/admin/satuan', label: 'Satuan', ikon: '📏' },
  { href: '/admin/pemasok', label: 'Pemasok', ikon: '🚚' },
  { href: '/admin/pembelian', label: 'Pembelian', ikon: '🧾' },
  { href: '/admin/resep', label: 'Resep', ikon: '📋' },
  { href: '/admin/stok', label: 'Kartu Stok', ikon: '🗃️' },
  { href: '/admin/biaya', label: 'Biaya', ikon: '💡' },
  { href: '/admin/laporan', label: 'Laporan', ikon: '📈' },
  { href: '/admin/pengguna', label: 'Pengguna', ikon: '👥' },
  { href: '/admin/pengaturan', label: 'Pengaturan', ikon: '⚙️' },
];

export function Sidebar({ nama }: { nama: string }) {
  const jalur = usePathname();
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);

  async function keluar() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  const aktif = (href: string) =>
    href === '/admin' ? jalur === '/admin' : jalur.startsWith(href);

  return (
    <>
      {/* Bilah atas untuk layar kecil */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-garis bg-permukaan px-3 py-2 lg:hidden">
        <button onClick={() => setTerbuka(true)} className="sentuh px-1 text-xl" aria-label="Buka menu">
          ☰
        </button>
        <span className="font-semibold">Back Office</span>
        <Link href="/kasir" className="ml-auto text-sm font-medium text-aksen">
          Kasir →
        </Link>
      </header>

      {terbuka && (
        <button
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setTerbuka(false)}
          aria-label="Tutup menu"
        />
      )}

      <aside
        className={gabung(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-garis bg-permukaan',
          'transition-transform lg:static lg:translate-x-0',
          terbuka ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 border-b border-garis px-4 py-4">
          <span className="text-2xl">🥟</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Back Office</p>
            <p className="truncate text-xs text-teks-lembut">{nama}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={() => setTerbuka(false)}
              className={gabung(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                aktif(m.href)
                  ? 'bg-aksen-lembut text-aksen-kuat'
                  : 'text-teks-lembut hover:bg-permukaan-2',
              )}
            >
              <span>{m.ikon}</span>
              {m.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t border-garis p-2">
          <Link
            href="/kasir"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-teks-lembut hover:bg-permukaan-2"
          >
            <span>🛒</span> Halaman Kasir
          </Link>
          <button
            onClick={keluar}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-bahaya hover:bg-bahaya/10"
          >
            <span>🚪</span> Keluar
          </button>
        </div>
      </aside>

      {/* Ruang untuk bilah atas mobile */}
      <div className="h-12 lg:hidden" aria-hidden />
    </>
  );
}
