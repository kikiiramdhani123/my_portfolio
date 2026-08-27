'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Memuat, Tombol, gabung } from '@/components/ui/dasar';
import { FilterTanggal, JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api, awalBulan, formatAngka, formatRupiah, formatWaktu, hariIni } from '@/lib/klien';

/** Laporan — Req 9.2–9.4 */

type Jenis = 'penjualan' | 'labarugi' | 'terlaris' | 'pembelian' | 'biaya';

const TAB: { kunci: Jenis; label: string }[] = [
  { kunci: 'penjualan', label: 'Penjualan' },
  { kunci: 'labarugi', label: 'Laba Rugi' },
  { kunci: 'terlaris', label: 'Produk Terlaris' },
  { kunci: 'pembelian', label: 'Pembelian' },
  { kunci: 'biaya', label: 'Biaya' },
];

export default function HalamanLaporan() {
  const [jenis, setJenis] = useState<Jenis>('penjualan');
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIni());
  const [hasil, setHasil] = useState<Record<string, string>[] | null>(null);
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    setHasil(null);
    setGalat('');
    api<{ hasil: Record<string, string>[] }>(`/api/laporan/${jenis}?dari=${dari}&sampai=${sampai}`)
      .then((d) => setHasil(d.hasil))
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat laporan.'));
  }, [jenis, dari, sampai]);

  useEffect(() => { muat(); }, [muat]);

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Laporan"
        keterangan="Pilih jenis laporan dan rentang tanggal. Setiap laporan dapat diunduh sebagai CSV."
        aksi={
          <a
            href={`/api/laporan/${jenis}?dari=${dari}&sampai=${sampai}&format=csv`}
            className="sentuh inline-flex items-center rounded-xl border border-garis px-4 py-2.5 text-sm font-medium hover:bg-permukaan-2"
          >
            ⬇️ Unduh CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TAB.map((t) => (
          <button
            key={t.kunci}
            onClick={() => setJenis(t.kunci)}
            className={gabung(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              jenis === t.kunci ? 'bg-aksen text-white' : 'bg-permukaan-2 text-teks-lembut hover:bg-garis',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterTanggal dari={dari} sampai={sampai} ubah={(a, b) => { setDari(a); setSampai(b); }} />

      {galat && <Galat pesan={galat} />}
      {!hasil ? <Memuat /> : <Isi jenis={jenis} hasil={hasil} />}
    </div>
  );
}

function Isi({ jenis, hasil }: { jenis: Jenis; hasil: Record<string, string>[] }) {
  if (jenis === 'labarugi') {
    return (
      <div className="max-w-xl overflow-hidden rounded-[var(--radius-kartu)] border border-garis bg-permukaan">
        {hasil.map((b, i) => {
          const total = b.jenis === 'TOTAL';
          return (
            <div
              key={i}
              className={gabung(
                'flex items-baseline justify-between border-b border-garis px-4 py-3 last:border-0',
                total && 'bg-permukaan-2 font-bold',
              )}
            >
              <span className={total ? '' : 'text-sm text-teks-lembut'}>{b.keterangan}</span>
              <span
                className={gabung(
                  'angka',
                  total
                    ? Number(b.nilai) >= 0 ? 'text-sukses' : 'text-bahaya'
                    : b.nilai.startsWith('-') ? 'text-bahaya' : '',
                )}
              >
                {formatRupiah(b.nilai)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (jenis === 'terlaris') {
    return (
      <Tabel kepala={['#', 'Produk', '~Qty', '~Omzet', '~Laba Kotor']} kosong={hasil.length === 0}>
        {hasil.map((b, i) => (
          <tr key={b.id_barang}>
            <Sel tebal>{i + 1}</Sel>
            <Sel>
              <p className="font-medium">{b.nama_barang}</p>
              <p className="text-xs text-teks-lembut">{b.kode_barang}</p>
            </Sel>
            <Sel kanan tebal>{formatAngka(b.qty)}</Sel>
            <Sel kanan>{formatRupiah(b.omzet)}</Sel>
            <Sel kanan className="text-sukses">{formatRupiah(b.laba_kotor)}</Sel>
          </tr>
        ))}
      </Tabel>
    );
  }

  if (jenis === 'pembelian') {
    return (
      <Tabel kepala={['Faktur', 'Tanggal', 'Pemasok', 'Status', '~Total']} kosong={hasil.length === 0}>
        {hasil.map((b) => (
          <tr key={b.id_pembelian}>
            <Sel tebal>{b.nomor_faktur_pembelian}</Sel>
            <Sel>{formatWaktu(b.tanggal_pembelian)}</Sel>
            <Sel>{b.nama_pemasok ?? '—'}</Sel>
            <Sel>{b.status_pembelian}</Sel>
            <Sel kanan tebal>{formatRupiah(b.total_pembelian)}</Sel>
          </tr>
        ))}
      </Tabel>
    );
  }

  if (jenis === 'biaya') {
    return (
      <Tabel kepala={['Tanggal', 'Kategori', 'Keterangan', 'Dicatat oleh', '~Jumlah']} kosong={hasil.length === 0}>
        {hasil.map((b) => (
          <tr key={b.id_biaya}>
            <Sel>{formatWaktu(b.tanggal_biaya)}</Sel>
            <Sel tebal>{b.kategori_biaya}</Sel>
            <Sel className="max-w-xs truncate">{b.keterangan ?? '—'}</Sel>
            <Sel>{b.nama_pengguna}</Sel>
            <Sel kanan tebal>{formatRupiah(b.jumlah)}</Sel>
          </tr>
        ))}
      </Tabel>
    );
  }

  return (
    <Tabel
      kepala={['Transaksi', 'Kasir', 'Metode', 'Status', '~Item', '~Total', '~Laba Kotor']}
      kosong={hasil.length === 0}
    >
      {hasil.map((b) => (
        <tr key={b.id_penjualan}>
          <Sel>
            <p className="font-medium">{b.nomor_transaksi}</p>
            <p className="text-xs text-teks-lembut">{formatWaktu(b.tanggal_penjualan)}</p>
          </Sel>
          <Sel>{b.nama_pengguna}</Sel>
          <Sel>{b.metode_pembayaran}</Sel>
          <Sel>{b.status_penjualan}</Sel>
          <Sel kanan>{formatAngka(b.jumlah_item)}</Sel>
          <Sel kanan tebal>{formatRupiah(b.total_penjualan)}</Sel>
          <Sel kanan className="text-sukses">{formatRupiah(b.laba_kotor)}</Sel>
        </tr>
      ))}
    </Tabel>
  );
}
