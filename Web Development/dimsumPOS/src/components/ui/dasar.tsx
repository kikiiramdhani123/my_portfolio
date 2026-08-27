'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Primitif UI tanpa pengetahuan domain POS (structure.md). */

export function gabung(...kelas: (string | false | null | undefined)[]): string {
  return kelas.filter(Boolean).join(' ');
}

type VarianTombol = 'utama' | 'lembut' | 'garis' | 'bahaya' | 'hantu';

export function Tombol({
  varian = 'lembut', kecil = false, className, ...sisa
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { varian?: VarianTombol; kecil?: boolean }) {
  const gaya: Record<VarianTombol, string> = {
    utama: 'bg-aksen text-white hover:bg-aksen-kuat shadow-sm',
    lembut: 'bg-permukaan-2 text-teks hover:bg-garis',
    garis: 'border border-garis bg-permukaan text-teks hover:bg-permukaan-2',
    bahaya: 'bg-bahaya text-white hover:opacity-90',
    hantu: 'text-teks-lembut hover:bg-permukaan-2',
  };
  return (
    <button
      {...sisa}
      className={gabung(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-aksen',
        kecil ? 'px-3 py-1.5 text-sm' : 'sentuh px-4 py-2.5 text-sm',
        gaya[varian],
        className,
      )}
    />
  );
}

export function Isian({ label, galat, className, ...sisa }:
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; galat?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-teks-lembut">{label}</span>}
      <input
        {...sisa}
        className={gabung(
          'w-full rounded-xl border border-garis bg-permukaan px-3 py-2.5 text-teks',
          'placeholder:text-teks-lembut/60 focus:border-aksen focus:outline-none',
          galat && 'border-bahaya',
          className,
        )}
      />
      {galat && <span className="mt-1 block text-xs text-bahaya">{galat}</span>}
    </label>
  );
}

export function Pilihan({ label, anak, className, children, ...sisa }:
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; anak?: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-teks-lembut">{label}</span>}
      <select
        {...sisa}
        className={gabung(
          'w-full rounded-xl border border-garis bg-permukaan px-3 py-2.5 text-teks',
          'focus:border-aksen focus:outline-none',
          className,
        )}
      >
        {children ?? anak}
      </select>
    </label>
  );
}

export function Kartu({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={gabung(
      'rounded-[var(--radius-kartu)] border border-garis bg-permukaan p-4 shadow-sm',
      className,
    )}>
      {children}
    </div>
  );
}

export function Lencana({ warna = 'lembut', children }:
  { warna?: 'lembut' | 'sukses' | 'bahaya' | 'peringatan'; children: ReactNode }) {
  const gaya = {
    lembut: 'bg-permukaan-2 text-teks-lembut',
    sukses: 'bg-sukses/15 text-sukses',
    bahaya: 'bg-bahaya/15 text-bahaya',
    peringatan: 'bg-peringatan/20 text-peringatan',
  }[warna];
  return (
    <span className={gabung('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', gaya)}>
      {children}
    </span>
  );
}

export function Modal({ judul, terbuka, tutup, lebar = 'max-w-lg', children }: {
  judul: string; terbuka: boolean; tutup: () => void; lebar?: string; children: ReactNode;
}) {
  const rujukan = useRef<HTMLDivElement>(null);

  // `tutup` sering berupa arrow function baru tiap render pemanggilnya. Disimpan di ref
  // agar effect di bawah tidak ikut berjalan ulang setiap kali isi form berubah.
  const rujukanTutup = useRef(tutup);
  rujukanTutup.current = tutup;

  useEffect(() => {
    if (!terbuka) return;
    const padaTombol = (e: KeyboardEvent) => { if (e.key === 'Escape') rujukanTutup.current(); };
    document.addEventListener('keydown', padaTombol);
    return () => document.removeEventListener('keydown', padaTombol);
  }, [terbuka]);

  // Fokus awal hanya sekali saat modal dibuka — tidak pernah merebut fokus saat mengetik.
  // Tombol ✕ sengaja dikecualikan agar fokus mendarat di isian pertama.
  useEffect(() => {
    if (!terbuka) return;
    rujukan.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [terbuka]);

  if (!terbuka) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        ref={rujukan}
        className={gabung(
          'animasi-masuk max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-permukaan',
          'p-5 shadow-xl sm:rounded-2xl', lebar,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{judul}</h2>
          <Tombol varian="hantu" kecil onClick={tutup} aria-label="Tutup">✕</Tombol>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Kosong({ pesan, ikon = '📭' }: { pesan: string; ikon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-teks-lembut">
      <span className="text-3xl">{ikon}</span>
      <p className="text-sm">{pesan}</p>
    </div>
  );
}

export function Memuat({ pesan = 'Memuat…' }: { pesan?: string }) {
  return <div className="py-10 text-center text-sm text-teks-lembut">{pesan}</div>;
}

export function Galat({ pesan }: { pesan: string }) {
  return (
    <div className="rounded-xl border border-bahaya/30 bg-bahaya/10 px-3 py-2 text-sm text-bahaya">
      {pesan}
    </div>
  );
}
