'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Memuat, Modal, Pilihan, Tombol } from '@/components/ui/dasar';
import { FilterTanggal, JudulHalaman, KartuKpi, Sel, Tabel } from '@/components/admin/umum';
import { api, awalBulan, formatRupiah, formatWaktu, hariIni } from '@/lib/klien';

/** Biaya operasional — Req 8.1–8.5 */

interface Biaya {
  id_biaya: string; tanggal_biaya: string; kategori_biaya: string;
  keterangan: string | null; jumlah: string; nama_pengguna: string;
}

const KATEGORI = ['LISTRIK', 'AIR', 'GAS', 'SEWA', 'GAJI', 'TRANSPORT', 'LAINNYA'];

export default function HalamanBiaya() {
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIni());
  const [baris, setBaris] = useState<Biaya[] | null>(null);
  const [terbuka, setTerbuka] = useState(false);
  const [kategori, setKategori] = useState('LISTRIK');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState(hariIni());
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    setBaris(null);
    api<Biaya[]>(`/api/biaya?dari=${dari}&sampai=${sampai}`)
      .then(setBaris)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat biaya.'));
  }, [dari, sampai]);

  useEffect(() => { muat(); }, [muat]);

  const total = (baris ?? []).reduce((n, b) => n + Number(b.jumlah), 0);
  const perKategori = Object.entries(
    (baris ?? []).reduce<Record<string, number>>((peta, b) => {
      peta[b.kategori_biaya] = (peta[b.kategori_biaya] ?? 0) + Number(b.jumlah);
      return peta;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  async function simpan() {
    setGalat('');
    try {
      await api('/api/biaya', {
        method: 'POST',
        json: {
          tanggalBiaya: `${tanggal}T12:00:00+07:00`,
          kategoriBiaya: kategori,
          keterangan: keterangan || null,
          jumlah,
        },
      });
      setTerbuka(false);
      setJumlah('');
      setKeterangan('');
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan biaya.');
    }
  }

  async function hapus(b: Biaya) {
    if (!confirm(`Hapus biaya ${b.kategori_biaya} ${formatRupiah(b.jumlah)}?`)) return;
    await api(`/api/biaya/${b.id_biaya}`, { method: 'DELETE' }).catch(() => undefined);
    muat();
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Biaya Operasional"
        keterangan="Listrik, sewa, gas, dan biaya lain. Tidak masuk stok, tetapi mengurangi laba bersih."
        aksi={<Tombol varian="utama" onClick={() => setTerbuka(true)}>+ Catat Biaya</Tombol>}
      />

      <FilterTanggal dari={dari} sampai={sampai} ubah={(a, b) => { setDari(a); setSampai(b); }} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Total Biaya" nilai={formatRupiah(total)} warna="bahaya" />
        {perKategori.slice(0, 3).map(([k, n]) => (
          <KartuKpi key={k} label={k} nilai={formatRupiah(n)} />
        ))}
      </div>

      {galat && !terbuka && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!baris ? <Memuat /> : (
        <Tabel kepala={['Tanggal', 'Kategori', 'Keterangan', '~Jumlah', '~Aksi']} kosong={baris.length === 0}>
          {baris.map((b) => (
            <tr key={b.id_biaya} className="hover:bg-permukaan-2">
              <Sel>
                <p className="text-xs">{formatWaktu(b.tanggal_biaya)}</p>
                <p className="text-xs text-teks-lembut">{b.nama_pengguna}</p>
              </Sel>
              <Sel tebal>{b.kategori_biaya}</Sel>
              <Sel className="max-w-xs truncate">{b.keterangan ?? '—'}</Sel>
              <Sel kanan tebal>{formatRupiah(b.jumlah)}</Sel>
              <Sel kanan>
                <Tombol varian="hantu" kecil onClick={() => hapus(b)}>Hapus</Tombol>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal judul="Catat Biaya" terbuka={terbuka} tutup={() => setTerbuka(false)} lebar="max-w-sm">
        <div className="space-y-3">
          <Isian
            label="Tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
          <Pilihan label="Kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
            {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
          </Pilihan>
          <Isian
            label="Jumlah (Rp)"
            inputMode="numeric"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
          />
          <Isian
            label="Keterangan"
            value={keterangan}
            placeholder="Mis. token listrik bulan Agustus"
            onChange={(e) => setKeterangan(e.target.value)}
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
