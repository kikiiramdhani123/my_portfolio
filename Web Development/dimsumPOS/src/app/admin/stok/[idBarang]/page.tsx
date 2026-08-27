'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Galat, Lencana, Memuat } from '@/components/ui/dasar';
import { JudulHalaman, KartuKpi, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatRupiah, formatWaktu } from '@/lib/klien';

/** Kartu stok satu barang dengan saldo berjalan — Req 7.6 */

interface Kartu {
  id_pergerakan_stok: string; tanggal_pergerakan: string; jenis_pergerakan: string;
  referensi_id: string | null; jumlah_satuan_dasar: string; arah_stok: number;
  harga_perolehan: string; nilai_persediaan: string; catatan: string | null;
  nama_pengguna: string; saldo_berjalan: string;
}

interface Data {
  barang: { kode_barang: string; nama_barang: string; kode_satuan: string; jenis_barang: string };
  posisi: { saldo: string; hpp: string; nilai: string };
  kartu: Kartu[];
}

const WARNA_JENIS: Record<string, 'sukses' | 'bahaya' | 'peringatan' | 'lembut'> = {
  PEMBELIAN: 'sukses',
  BATAL_PENJUALAN: 'sukses',
  PENJUALAN: 'bahaya',
  PEMAKAIAN_RESEP: 'bahaya',
  BATAL_PEMBELIAN: 'bahaya',
  PENYESUAIAN: 'peringatan',
};

export default function KartuStokBarang({ params }: { params: Promise<{ idBarang: string }> }) {
  const { idBarang } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    api<Data>(`/api/stok/${idBarang}`)
      .then(setData)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat kartu stok.'));
  }, [idBarang]);

  if (galat) return <div className="p-6"><Galat pesan={galat} /></div>;
  if (!data) return <Memuat />;

  return (
    <div className="p-4 lg:p-6">
      <Link href="/admin/stok" className="mb-3 inline-block text-sm text-aksen">← Kembali ke daftar stok</Link>

      <JudulHalaman
        judul={data.barang.nama_barang}
        keterangan={`${data.barang.kode_barang} · ${data.barang.jenis_barang} · satuan dasar ${data.barang.kode_satuan}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KartuKpi
          label="Saldo"
          nilai={`${formatAngka(data.posisi.saldo)} ${data.barang.kode_satuan}`}
          warna={Number(data.posisi.saldo) <= 0 ? 'bahaya' : 'netral'}
        />
        <KartuKpi label="HPP Rata-rata" nilai={formatRupiah(data.posisi.hpp)} warna="aksen" />
        <KartuKpi label="Nilai Persediaan" nilai={formatRupiah(data.posisi.nilai)} />
      </div>

      <Tabel
        kepala={['Waktu', 'Jenis', '~Masuk', '~Keluar', '~Saldo', '~HPP', 'Catatan']}
        kosong={data.kartu.length === 0}
      >
        {data.kartu.map((k) => (
          <tr key={k.id_pergerakan_stok} className="hover:bg-permukaan-2">
            <Sel>
              <p className="text-xs">{formatWaktu(k.tanggal_pergerakan)}</p>
              <p className="text-xs text-teks-lembut">{k.nama_pengguna}</p>
            </Sel>
            <Sel>
              <Lencana warna={WARNA_JENIS[k.jenis_pergerakan] ?? 'lembut'}>
                {k.jenis_pergerakan.replace(/_/g, ' ')}
              </Lencana>
            </Sel>
            <Sel kanan tebal className="text-sukses">
              {k.arah_stok === 1 ? formatAngka(k.jumlah_satuan_dasar) : ''}
            </Sel>
            <Sel kanan tebal className="text-bahaya">
              {k.arah_stok === -1 ? formatAngka(k.jumlah_satuan_dasar) : ''}
            </Sel>
            <Sel kanan tebal>{formatAngka(k.saldo_berjalan)}</Sel>
            <Sel kanan>{formatRupiah(k.harga_perolehan)}</Sel>
            <Sel className="max-w-[220px] truncate text-xs text-teks-lembut">{k.catatan ?? '—'}</Sel>
          </tr>
        ))}
      </Tabel>

      <p className="mt-3 text-xs text-teks-lembut">
        Kartu stok bersifat permanen — koreksi dilakukan lewat pergerakan penyesuaian, bukan penghapusan baris.
      </p>
    </div>
  );
}
