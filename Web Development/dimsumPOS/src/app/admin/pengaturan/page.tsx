'use client';

import { useEffect, useState } from 'react';
import { Galat, Isian, Kartu, Memuat, Tombol } from '@/components/ui/dasar';
import { JudulHalaman } from '@/components/admin/umum';
import { api } from '@/lib/klien';

const FIELD: { kunci: string; label: string; petunjuk?: string }[] = [
  { kunci: 'nama_toko', label: 'Nama Toko' },
  { kunci: 'alamat_toko', label: 'Alamat Toko' },
  { kunci: 'telepon_toko', label: 'Nomor Telepon' },
  { kunci: 'catatan_struk', label: 'Catatan Bawah Struk' },
  { kunci: 'pajak_persen', label: 'Pajak (%)', petunjuk: 'Isi 0 bila tidak memungut pajak.' },
  {
    kunci: 'izinkan_stok_minus',
    label: 'Izinkan Stok Minus (true/false)',
    petunjuk: 'true = penjualan tetap jalan walau stok bahan habis, agar antrean tidak terhenti.',
  },
];

export default function HalamanPengaturan() {
  const [nilai, setNilai] = useState<Record<string, string> | null>(null);
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    api<Record<string, string>>('/api/pengaturan')
      .then(setNilai)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat pengaturan.'));
  }, []);

  async function simpan() {
    if (!nilai) return;
    setMenyimpan(true);
    setGalat('');
    setPesan('');
    try {
      await api('/api/pengaturan', { method: 'PUT', json: { nilai } });
      setPesan('Pengaturan tersimpan.');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  if (galat && !nilai) return <div className="p-6"><Galat pesan={galat} /></div>;
  if (!nilai) return <Memuat />;

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman judul="Pengaturan Toko" keterangan="Identitas toko yang tercetak pada struk dan perilaku kasir." />

      <Kartu className="max-w-xl space-y-4">
        {FIELD.map((f) => (
          <div key={f.kunci}>
            <Isian
              label={f.label}
              value={nilai[f.kunci] ?? ''}
              onChange={(e) => setNilai({ ...nilai, [f.kunci]: e.target.value })}
            />
            {f.petunjuk && <p className="mt-1 text-xs text-teks-lembut">{f.petunjuk}</p>}
          </div>
        ))}

        {galat && <Galat pesan={galat} />}
        {pesan && (
          <div className="rounded-xl border border-sukses/30 bg-sukses/10 px-3 py-2 text-sm text-sukses">
            {pesan}
          </div>
        )}

        <Tombol varian="utama" onClick={simpan} disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </Tombol>
      </Kartu>
    </div>
  );
}
