'use client';

import { useEffect, useState } from 'react';
import { Galat, Kartu, Kosong, Lencana, Memuat } from '@/components/ui/dasar';
import { api, formatRupiah, formatWaktu } from '@/lib/klien';

/** Req 6.12 — kasir hanya melihat transaksi hari ini miliknya sendiri. */

interface BarisRiwayat {
  id_penjualan: string;
  nomor_transaksi: string;
  tanggal_penjualan: string;
  total_penjualan: string;
  metode_pembayaran: string;
  status_penjualan: string;
  nama_pengguna: string;
  jumlah_item: string;
}

export default function HalamanRiwayat() {
  const [baris, setBaris] = useState<BarisRiwayat[] | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    api<BarisRiwayat[]>('/api/penjualan')
      .then(setBaris)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat riwayat.'));
  }, []);

  const total = (baris ?? [])
    .filter((b) => b.status_penjualan === 'SELESAI')
    .reduce((n, b) => n + Number(b.total_penjualan), 0);

  if (galat) return <div className="p-4"><Galat pesan={galat} /></div>;
  if (!baris) return <Memuat />;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-3 p-4">
      <Kartu className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-teks-lembut">Transaksi hari ini</p>
          <p className="text-xl font-bold">{baris.length} transaksi</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-teks-lembut">Total</p>
          <p className="angka text-xl font-bold text-aksen-kuat">{formatRupiah(total)}</p>
        </div>
      </Kartu>

      {baris.length === 0 ? (
        <Kosong pesan="Belum ada transaksi hari ini." ikon="🧾" />
      ) : (
        <ul className="space-y-2">
          {baris.map((b) => (
            <li
              key={b.id_penjualan}
              className="flex items-center gap-3 rounded-[var(--radius-kartu)] border border-garis bg-permukaan p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{b.nomor_transaksi}</p>
                <p className="text-xs text-teks-lembut">
                  {formatWaktu(b.tanggal_penjualan)} · {Number(b.jumlah_item)} item · {b.metode_pembayaran}
                </p>
              </div>
              {b.status_penjualan === 'BATAL' && <Lencana warna="bahaya">Batal</Lencana>}
              <span className="angka font-bold">{formatRupiah(b.total_penjualan)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
