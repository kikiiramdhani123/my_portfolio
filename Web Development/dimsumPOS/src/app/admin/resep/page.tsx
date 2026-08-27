'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Memuat, Modal, Pilihan, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatTanggal } from '@/lib/klien';

/** Resep / komposisi produk — Req 5.1–5.7 */

interface Resep {
  id_resep: string; nama_resep: string; versi_resep: number; tanggal_berlaku: string;
  id_barang_hasil: string; kode_barang: string; nama_barang: string; jumlah_bahan: string;
}
interface Barang {
  id_barang: string; kode_barang: string; nama_barang: string;
  kode_satuan: string; id_satuan_dasar: string; dapat_dijual: boolean;
}
interface BarisBahan { idBarangBahan: string; idSatuan: string; jumlah: string }

export default function HalamanResep() {
  const [daftar, setDaftar] = useState<Resep[] | null>(null);
  const [barang, setBarang] = useState<Barang[]>([]);
  const [terbuka, setTerbuka] = useState(false);
  const [idHasil, setIdHasil] = useState('');
  const [namaResep, setNamaResep] = useState('');
  const [bahan, setBahan] = useState<BarisBahan[]>([]);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(() => {
    api<Resep[]>('/api/resep').then(setDaftar).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat resep.'));
  }, []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { api<Barang[]>('/api/barang').then(setBarang).catch(() => undefined); }, []);

  const produkJual = barang.filter((b) => b.dapat_dijual);
  const calonBahan = barang.filter((b) => !b.dapat_dijual || b.id_barang !== idHasil);

  async function buka(idBarangHasil?: string) {
    setGalat('');
    setTerbuka(true);
    const id = idBarangHasil ?? '';
    setIdHasil(id);
    if (!id) {
      setNamaResep('');
      setBahan([{ idBarangBahan: '', idSatuan: '', jumlah: '1' }]);
      return;
    }
    await muatResep(id);
  }

  async function muatResep(id: string) {
    const hasil = await api<{
      header: { nama_resep: string } | null;
      detail: { id_barang_bahan: string; id_satuan: string; jumlah: string }[];
    }>(`/api/resep/${id}`);

    const produk = barang.find((b) => b.id_barang === id);
    setNamaResep(hasil.header?.nama_resep ?? `Resep ${produk?.nama_barang ?? ''}`);
    setBahan(hasil.detail.length > 0
      ? hasil.detail.map((d) => ({
          idBarangBahan: d.id_barang_bahan, idSatuan: d.id_satuan, jumlah: d.jumlah,
        }))
      : [{ idBarangBahan: '', idSatuan: '', jumlah: '1' }]);
  }

  function pilihBahan(indeks: number, idBarangBahan: string) {
    const b = barang.find((x) => x.id_barang === idBarangBahan);
    setBahan((lama) => lama.map((x, i) => (i === indeks
      ? { ...x, idBarangBahan, idSatuan: b?.id_satuan_dasar ?? '' }
      : x)));
  }

  async function simpan() {
    setMenyimpan(true);
    setGalat('');
    try {
      await api('/api/resep', {
        method: 'POST',
        json: {
          idBarangHasil: idHasil,
          namaResep,
          detail: bahan
            .filter((b) => b.idBarangBahan && b.idSatuan)
            .map((b) => ({ idBarangBahan: b.idBarangBahan, idSatuan: b.idSatuan, jumlah: b.jumlah })),
        },
      });
      setTerbuka(false);
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan resep.');
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Resep Produk"
        keterangan="Tentukan bahan dan kemasan tiap produk. Satu penjualan otomatis mengurangi stok bahannya."
        aksi={<Tombol varian="utama" onClick={() => buka()}>+ Resep Baru</Tombol>}
      />

      {galat && !terbuka && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!daftar ? <Memuat /> : (
        <Tabel kepala={['Produk', 'Nama Resep', '~Versi', '~Bahan', 'Berlaku', '~Aksi']} kosong={daftar.length === 0}>
          {daftar.map((r) => (
            <tr key={r.id_resep} className="hover:bg-permukaan-2">
              <Sel>
                <p className="font-medium">{r.nama_barang}</p>
                <p className="text-xs text-teks-lembut">{r.kode_barang}</p>
              </Sel>
              <Sel>{r.nama_resep}</Sel>
              <Sel kanan>v{r.versi_resep}</Sel>
              <Sel kanan>{r.jumlah_bahan}</Sel>
              <Sel>{formatTanggal(r.tanggal_berlaku)}</Sel>
              <Sel kanan>
                <Tombol varian="hantu" kecil onClick={() => buka(r.id_barang_hasil)}>Ubah</Tombol>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal judul="Resep Produk" terbuka={terbuka} tutup={() => setTerbuka(false)} lebar="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Pilihan
              label="Produk Hasil"
              value={idHasil}
              onChange={(e) => { setIdHasil(e.target.value); if (e.target.value) muatResep(e.target.value); }}
            >
              <option value="">— pilih produk —</option>
              {produkJual.map((b) => (
                <option key={b.id_barang} value={b.id_barang}>{b.nama_barang}</option>
              ))}
            </Pilihan>
            <Isian
              label="Nama Resep"
              value={namaResep}
              onChange={(e) => setNamaResep(e.target.value)}
            />
          </div>

          <p className="text-xs text-teks-lembut">
            Jumlah bahan dihitung untuk <strong>1 satuan dasar</strong> produk hasil.
            Menyimpan akan membuat versi baru dan menonaktifkan versi sebelumnya.
          </p>

          <div className="space-y-2">
            {bahan.map((b, i) => {
              const info = barang.find((x) => x.id_barang === b.idBarangBahan);
              return (
                <div key={i} className="grid gap-2 rounded-xl bg-permukaan-2 p-3 sm:grid-cols-[2fr_1fr_auto_auto]">
                  <select
                    value={b.idBarangBahan}
                    onChange={(e) => pilihBahan(i, e.target.value)}
                    className="rounded-lg border border-garis bg-permukaan px-2 py-2 text-sm"
                  >
                    <option value="">— pilih bahan —</option>
                    {calonBahan.map((x) => (
                      <option key={x.id_barang} value={x.id_barang}>
                        {x.nama_barang} ({x.kode_satuan})
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    value={b.jumlah}
                    onChange={(e) => setBahan((l) => l.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))}
                    className="angka rounded-lg border border-garis bg-permukaan px-2 py-2 text-right text-sm"
                  />
                  <span className="self-center text-xs text-teks-lembut">{info?.kode_satuan ?? ''}</span>
                  <Tombol
                    varian="hantu"
                    kecil
                    onClick={() => setBahan((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : l))}
                  >
                    ✕
                  </Tombol>
                </div>
              );
            })}
            <Tombol
              varian="garis"
              kecil
              onClick={() => setBahan((l) => [...l, { idBarangBahan: '', idSatuan: '', jumlah: '1' }])}
            >
              + Tambah Bahan
            </Tombol>
          </div>

          {galat && <Galat pesan={galat} />}

          <div className="flex gap-2">
            <Tombol varian="garis" className="flex-1" onClick={() => setTerbuka(false)}>Batal</Tombol>
            <Tombol varian="utama" className="flex-1" onClick={simpan} disabled={menyimpan || !idHasil}>
              {menyimpan ? 'Menyimpan…' : 'Simpan Resep'}
            </Tombol>
          </div>
        </div>
      </Modal>

      <p className="mt-4 text-xs text-teks-lembut">
        {formatAngka(daftar?.length ?? 0)} resep aktif.
      </p>
    </div>
  );
}
