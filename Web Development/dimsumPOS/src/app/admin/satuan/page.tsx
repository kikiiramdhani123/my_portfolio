'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Memuat, Modal, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api } from '@/lib/klien';

interface Satuan { id_satuan: string; kode_satuan: string; nama_satuan: string; dipakai: string }

export default function HalamanSatuan() {
  const [baris, setBaris] = useState<Satuan[] | null>(null);
  const [terbuka, setTerbuka] = useState(false);
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    api<Satuan[]>('/api/satuan').then(setBaris).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat satuan.'));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    setGalat('');
    try {
      await api('/api/satuan', { method: 'POST', json: { kodeSatuan: kode, namaSatuan: nama } });
      setTerbuka(false);
      setKode('');
      setNama('');
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Satuan"
        keterangan="Satuan dipakai untuk stok, pembelian, dan penjualan. Konversi antar satuan diatur per barang."
        aksi={<Tombol varian="utama" onClick={() => setTerbuka(true)}>+ Satuan Baru</Tombol>}
      />

      {galat && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!baris ? <Memuat /> : (
        <Tabel kepala={['Kode', 'Nama', '~Dipakai oleh']} kosong={baris.length === 0}>
          {baris.map((s) => (
            <tr key={s.id_satuan}>
              <Sel tebal>{s.kode_satuan}</Sel>
              <Sel>{s.nama_satuan}</Sel>
              <Sel kanan>{s.dipakai} barang</Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal judul="Satuan Baru" terbuka={terbuka} tutup={() => setTerbuka(false)} lebar="max-w-sm">
        <div className="space-y-3">
          <Isian
            label="Kode Satuan"
            value={kode}
            placeholder="BOX"
            onChange={(e) => setKode(e.target.value.toUpperCase())}
          />
          <Isian
            label="Nama Satuan"
            value={nama}
            placeholder="Box"
            onChange={(e) => setNama(e.target.value)}
          />
          {galat && <Galat pesan={galat} />}
          <div className="flex gap-2">
            <Tombol varian="garis" className="flex-1" onClick={() => setTerbuka(false)}>Batal</Tombol>
            <Tombol varian="utama" className="flex-1" onClick={simpan}>Simpan</Tombol>
          </div>
        </div>
      </Modal>
    </div>
  );
}
