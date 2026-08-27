'use client';

import type { ReactNode } from 'react';
import { gabung } from '@/components/ui/dasar';

/** Potongan tampilan yang dipakai berulang di seluruh back office. */

export function JudulHalaman({ judul, keterangan, aksi }: {
  judul: string; keterangan?: string; aksi?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{judul}</h1>
        {keterangan && <p className="mt-1 text-sm text-teks-lembut">{keterangan}</p>}
      </div>
      {aksi && <div className="flex flex-wrap gap-2">{aksi}</div>}
    </div>
  );
}

export function KartuKpi({ label, nilai, keterangan, warna = 'netral' }: {
  label: string; nilai: string; keterangan?: string;
  warna?: 'netral' | 'sukses' | 'bahaya' | 'aksen';
}) {
  const gaya = {
    netral: 'text-teks',
    sukses: 'text-sukses',
    bahaya: 'text-bahaya',
    aksen: 'text-aksen-kuat',
  }[warna];

  return (
    <div className="rounded-[var(--radius-kartu)] border border-garis bg-permukaan p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-teks-lembut">{label}</p>
      <p className={gabung('angka mt-1.5 text-2xl font-bold', gaya)}>{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-teks-lembut">{keterangan}</p>}
    </div>
  );
}

export function Tabel({ kepala, children, kosong }: {
  kepala: readonly string[]; children: ReactNode; kosong?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-kartu)] border border-garis bg-permukaan">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-garis bg-permukaan-2 text-left">
            {kepala.map((k) => (
              <th
                key={k}
                className={gabung(
                  'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-teks-lembut',
                  k.startsWith('~') && 'text-right',
                )}
              >
                {k.replace(/^~/, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-garis">
          {kosong ? (
            <tr>
              <td colSpan={kepala.length} className="px-3 py-10 text-center text-teks-lembut">
                Belum ada data.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Sel({ kanan, tebal, className, children }: {
  kanan?: boolean; tebal?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <td className={gabung(
      'px-3 py-2.5',
      kanan && 'angka text-right',
      tebal && 'font-semibold',
      className,
    )}>
      {children}
    </td>
  );
}

export function FilterTanggal({ dari, sampai, ubah, aksi }: {
  dari: string; sampai: string;
  ubah: (dari: string, sampai: string) => void;
  aksi?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-xs text-teks-lembut">Dari</span>
        <input
          type="date"
          value={dari}
          onChange={(e) => ubah(e.target.value, sampai)}
          className="rounded-xl border border-garis bg-permukaan px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-teks-lembut">Sampai</span>
        <input
          type="date"
          value={sampai}
          onChange={(e) => ubah(dari, e.target.value)}
          className="rounded-xl border border-garis bg-permukaan px-3 py-2 text-sm"
        />
      </label>
      {aksi}
    </div>
  );
}
