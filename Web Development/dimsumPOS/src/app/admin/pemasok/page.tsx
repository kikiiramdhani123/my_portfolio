'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Lencana, Memuat, Modal, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api } from '@/lib/klien';

interface Pemasok {
  id_pemasok: string; kode_pemasok: string; nama_pemasok: string;
  nomor_telepon: string | null; alamat: string | null; status_aktif: boolean;
}

interface Draf {
  idPemasok?: string; kodePemasok: string; namaPemasok: string;
  nomorTelepon: string; alamat: string; statusAktif: boolean;
}

const KOSONG: Draf = {
  kodePemasok: '', namaPemasok: '', nomorTelepon: '', alamat: '', statusAktif: true,
};

export default function HalamanPemasok() {
  const [baris, setBaris] = useState<Pemasok[] | null>(null);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    api<Pemasok[]>('/api/pemasok').then(setBaris).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat pemasok.'));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!draf) return;
    setGalat('');
    try {
      const isi = {
        kodePemasok: draf.kodePemasok, namaPemasok: draf.namaPemasok,
        nomorTelepon: draf.nomorTelepon || null, alamat: draf.alamat || null,
        statusAktif: draf.statusAktif,
      };
      if (draf.idPemasok) await api(`/api/pemasok/${draf.idPemasok}`, { method: 'PUT', json: isi });
      else await api('/api/pemasok', { method: 'POST', json: isi });
      setDraf(null);
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Pemasok"
        keterangan="Daftar tempat Anda membeli bahan dan kemasan."
        aksi={<Tombol varian="utama" onClick={() => setDraf({ ...KOSONG })}>+ Pemasok Baru</Tombol>}
      />

      {galat && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!baris ? <Memuat /> : (
        <Tabel kepala={['Pemasok', 'Telepon', 'Alamat', 'Status', '~Aksi']} kosong={baris.length === 0}>
          {baris.map((p) => (
            <tr key={p.id_pemasok} className="hover:bg-permukaan-2">
              <Sel>
                <p className="font-medium">{p.nama_pemasok}</p>
                <p className="text-xs text-teks-lembut">{p.kode_pemasok}</p>
              </Sel>
              <Sel>{p.nomor_telepon ?? '—'}</Sel>
              <Sel className="max-w-xs truncate">{p.alamat ?? '—'}</Sel>
              <Sel>
                {p.status_aktif
                  ? <Lencana warna="sukses">Aktif</Lencana>
                  : <Lencana warna="bahaya">Nonaktif</Lencana>}
              </Sel>
              <Sel kanan>
                <Tombol
                  varian="hantu"
                  kecil
                  onClick={() => setDraf({
                    idPemasok: p.id_pemasok, kodePemasok: p.kode_pemasok,
                    namaPemasok: p.nama_pemasok, nomorTelepon: p.nomor_telepon ?? '',
                    alamat: p.alamat ?? '', statusAktif: p.status_aktif,
                  })}
                >
                  Ubah
                </Tombol>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal
        judul={draf?.idPemasok ? 'Ubah Pemasok' : 'Pemasok Baru'}
        terbuka={draf !== null}
        tutup={() => setDraf(null)}
      >
        {draf && (
          <div className="space-y-3">
            <Isian
              label="Kode Pemasok"
              value={draf.kodePemasok}
              onChange={(e) => setDraf({ ...draf, kodePemasok: e.target.value.toUpperCase() })}
            />
            <Isian
              label="Nama Pemasok"
              value={draf.namaPemasok}
              onChange={(e) => setDraf({ ...draf, namaPemasok: e.target.value })}
            />
            <Isian
              label="Nomor Telepon"
              value={draf.nomorTelepon}
              onChange={(e) => setDraf({ ...draf, nomorTelepon: e.target.value })}
            />
            <Isian
              label="Alamat"
              value={draf.alamat}
              onChange={(e) => setDraf({ ...draf, alamat: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draf.statusAktif}
                onChange={(e) => setDraf({ ...draf, statusAktif: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-aksen)]"
              />
              Aktif
            </label>
            {galat && <Galat pesan={galat} />}
            <div className="flex gap-2">
              <Tombol varian="garis" className="flex-1" onClick={() => setDraf(null)}>Batal</Tombol>
              <Tombol varian="utama" className="flex-1" onClick={simpan}>Simpan</Tombol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
