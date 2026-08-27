'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Galat, Isian, Lencana, Memuat, Modal, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, KartuKpi, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatRupiah } from '@/lib/klien';

/** Kartu stok & opname — Req 7.4–7.6 */

interface Stok {
  id_barang: string; kode_barang: string; nama_barang: string; jenis_barang: string;
  kode_satuan: string; stok_minimum: string; saldo: string; hpp: string;
  nilai_persediaan: string; menipis: boolean;
}

export default function HalamanStok() {
  const [baris, setBaris] = useState<Stok[] | null>(null);
  const [cari, setCari] = useState('');
  const [opname, setOpname] = useState<Stok | null>(null);
  const [stokFisik, setStokFisik] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    api<Stok[]>(`/api/stok${cari ? `?cari=${encodeURIComponent(cari)}` : ''}`)
      .then(setBaris)
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat stok.'));
  }, [cari]);

  useEffect(() => { muat(); }, [muat]);

  const nilaiTotal = (baris ?? []).reduce((n, b) => n + Number(b.nilai_persediaan), 0);
  const jumlahMenipis = (baris ?? []).filter((b) => b.menipis).length;

  async function simpanOpname() {
    if (!opname) return;
    setGalat('');
    if (catatan.trim().length < 3) {
      setGalat('Catatan wajib diisi minimal 3 karakter, mis. alasan penyesuaian ini.');
      return;
    }
    try {
      await api('/api/stok/opname', {
        method: 'POST',
        json: { idBarang: opname.id_barang, stokFisik, catatan },
      });
      setOpname(null);
      setStokFisik('');
      setCatatan('');
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan penyesuaian.');
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Kartu Stok"
        keterangan="Saldo dan nilai persediaan seluruh barang. Setiap perubahan tercatat permanen."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KartuKpi label="Nilai Persediaan" nilai={formatRupiah(nilaiTotal)} warna="aksen" />
        <KartuKpi label="Jenis Barang" nilai={String(baris?.length ?? 0)} />
        <KartuKpi
          label="Stok Menipis"
          nilai={String(jumlahMenipis)}
          warna={jumlahMenipis > 0 ? 'bahaya' : 'sukses'}
        />
      </div>

      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari barang…"
        className="mb-4 w-full max-w-sm rounded-xl border border-garis bg-permukaan px-3 py-2 text-sm"
      />

      {galat && !opname && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!baris ? <Memuat /> : (
        <Tabel
          kepala={['Barang', '~Saldo', '~Minimum', '~HPP', '~Nilai', 'Status', '~Aksi']}
          kosong={baris.length === 0}
        >
          {baris.map((s) => (
            <tr key={s.id_barang} className="hover:bg-permukaan-2">
              <Sel>
                <Link href={`/admin/stok/${s.id_barang}`} className="font-medium hover:underline">
                  {s.nama_barang}
                </Link>
                <p className="text-xs text-teks-lembut">{s.kode_barang} · {s.jenis_barang}</p>
              </Sel>
              <Sel kanan tebal>{formatAngka(s.saldo)} {s.kode_satuan}</Sel>
              <Sel kanan>{formatAngka(s.stok_minimum)}</Sel>
              <Sel kanan>{formatRupiah(s.hpp)}</Sel>
              <Sel kanan>{formatRupiah(s.nilai_persediaan)}</Sel>
              <Sel>
                {Number(s.saldo) <= 0
                  ? <Lencana warna="bahaya">Habis</Lencana>
                  : s.menipis
                    ? <Lencana warna="peringatan">Menipis</Lencana>
                    : <Lencana warna="sukses">Aman</Lencana>}
              </Sel>
              <Sel kanan>
                <Tombol
                  varian="hantu"
                  kecil
                  onClick={() => { setOpname(s); setStokFisik(s.saldo); setCatatan(''); }}
                >
                  Opname
                </Tombol>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal
        judul={`Stok Opname — ${opname?.nama_barang ?? ''}`}
        terbuka={opname !== null}
        tutup={() => setOpname(null)}
        lebar="max-w-sm"
      >
        {opname && (
          <div className="space-y-3">
            <div className="rounded-xl bg-permukaan-2 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-teks-lembut">Stok sistem</span>
                <span className="angka font-semibold">
                  {formatAngka(opname.saldo)} {opname.kode_satuan}
                </span>
              </div>
            </div>
            <Isian
              label={`Stok Fisik (${opname.kode_satuan})`}
              inputMode="decimal"
              value={stokFisik}
              onChange={(e) => setStokFisik(e.target.value)}
            />
            <Isian
              label="Catatan (wajib)"
              value={catatan}
              placeholder="Mis. hasil hitung fisik akhir bulan"
              onChange={(e) => setCatatan(e.target.value)}
            />
            <div className="rounded-xl bg-aksen-lembut px-4 py-2.5 text-sm">
              Selisih:{' '}
              <strong className="angka">
                {formatAngka(Number(stokFisik || 0) - Number(opname.saldo))}
              </strong>
            </div>
            {galat && <Galat pesan={galat} />}
            <div className="flex gap-2">
              <Tombol varian="garis" className="flex-1" onClick={() => setOpname(null)}>Batal</Tombol>
              <Tombol varian="utama" className="flex-1" onClick={simpanOpname}>Simpan</Tombol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
