'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Lencana, Memuat, Modal, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api, formatTanggal } from '@/lib/klien';

/** Pengguna, peran, dan matriks hak akses — Req 2.2, 2.6, 2.7 */

interface Pengguna {
  id_pengguna: string; nama_pengguna: string; username: string;
  status_aktif: boolean; created_at: string; peran: string[];
}
interface Peran { id_peran: string; nama_peran: string }
interface HakAkses { id_hak_akses: string; kode_hak_akses: string; nama_hak_akses: string }
interface Izin {
  id_peran: string; kode_hak_akses: string;
  boleh_lihat: boolean; boleh_tambah: boolean; boleh_ubah: boolean; boleh_hapus: boolean;
}
interface Draf {
  idPengguna?: string; namaPengguna: string; username: string;
  kataSandi: string; statusAktif: boolean; peran: string[];
}

const KOSONG: Draf = {
  namaPengguna: '', username: '', kataSandi: '', statusAktif: true, peran: ['KASIR'],
};

export default function HalamanPengguna() {
  const [pengguna, setPengguna] = useState<Pengguna[] | null>(null);
  const [peran, setPeran] = useState<Peran[]>([]);
  const [hakAkses, setHakAkses] = useState<HakAkses[]>([]);
  const [izin, setIzin] = useState<Izin[]>([]);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    api<Pengguna[]>('/api/pengguna').then(setPengguna).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat pengguna.'));
    api<{ peran: Peran[]; hakAkses: HakAkses[]; izin: Izin[] }>('/api/peran')
      .then((d) => { setPeran(d.peran); setHakAkses(d.hakAkses); setIzin(d.izin); })
      .catch(() => undefined);
  }, []);

  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!draf) return;
    setGalat('');
    try {
      const isi = {
        namaPengguna: draf.namaPengguna,
        username: draf.username,
        statusAktif: draf.statusAktif,
        peran: draf.peran,
        ...(draf.kataSandi ? { kataSandi: draf.kataSandi } : {}),
      };
      if (draf.idPengguna) await api(`/api/pengguna/${draf.idPengguna}`, { method: 'PUT', json: isi });
      else await api('/api/pengguna', { method: 'POST', json: isi });
      setDraf(null);
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan pengguna.');
    }
  }

  const izinPeran = (idPeran: string, kode: string) =>
    izin.find((i) => i.id_peran === idPeran && i.kode_hak_akses === kode);

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Pengguna & Hak Akses"
        keterangan="Kasir hanya dapat membuka halaman penjualan. Minimal satu pemilik aktif harus selalu ada."
        aksi={<Tombol varian="utama" onClick={() => setDraf({ ...KOSONG })}>+ Pengguna Baru</Tombol>}
      />

      {galat && !draf && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!pengguna ? <Memuat /> : (
        <Tabel kepala={['Nama', 'Username', 'Peran', 'Status', 'Dibuat', '~Aksi']} kosong={pengguna.length === 0}>
          {pengguna.map((u) => (
            <tr key={u.id_pengguna} className="hover:bg-permukaan-2">
              <Sel tebal>{u.nama_pengguna}</Sel>
              <Sel>{u.username}</Sel>
              <Sel>
                <div className="flex flex-wrap gap-1">
                  {u.peran.map((p) => (
                    <Lencana key={p} warna={p === 'OWNER' ? 'peringatan' : 'lembut'}>{p}</Lencana>
                  ))}
                </div>
              </Sel>
              <Sel>
                {u.status_aktif
                  ? <Lencana warna="sukses">Aktif</Lencana>
                  : <Lencana warna="bahaya">Nonaktif</Lencana>}
              </Sel>
              <Sel>{formatTanggal(u.created_at)}</Sel>
              <Sel kanan>
                <Tombol
                  varian="hantu"
                  kecil
                  onClick={() => setDraf({
                    idPengguna: u.id_pengguna, namaPengguna: u.nama_pengguna,
                    username: u.username, kataSandi: '', statusAktif: u.status_aktif,
                    peran: u.peran,
                  })}
                >
                  Ubah
                </Tombol>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Matriks Hak Akses</h2>
      <div className="overflow-x-auto rounded-[var(--radius-kartu)] border border-garis bg-permukaan">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-garis bg-permukaan-2 text-left">
              <th className="px-3 py-2.5 text-xs font-semibold uppercase text-teks-lembut">Hak Akses</th>
              {peran.map((p) => (
                <th key={p.id_peran} className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-teks-lembut">
                  {p.nama_peran}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {hakAkses.map((h) => (
              <tr key={h.id_hak_akses}>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{h.nama_hak_akses}</p>
                  <p className="text-xs text-teks-lembut">{h.kode_hak_akses}</p>
                </td>
                {peran.map((p) => {
                  const i = izinPeran(p.id_peran, h.kode_hak_akses);
                  const aksi = [
                    ['L', i?.boleh_lihat], ['T', i?.boleh_tambah],
                    ['U', i?.boleh_ubah], ['H', i?.boleh_hapus],
                  ] as const;
                  return (
                    <td key={p.id_peran} className="px-3 py-2.5 text-center">
                      {aksi.some(([, ada]) => ada) ? (
                        <span className="inline-flex gap-1">
                          {aksi.filter(([, ada]) => ada).map(([label]) => (
                            <span
                              key={label}
                              className="rounded bg-sukses/15 px-1.5 py-0.5 text-[10px] font-bold text-sukses"
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-teks-lembut">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-teks-lembut">
        L = lihat · T = tambah · U = ubah · H = hapus. Hak akses divalidasi di server pada setiap permintaan.
      </p>

      <Modal
        judul={draf?.idPengguna ? 'Ubah Pengguna' : 'Pengguna Baru'}
        terbuka={draf !== null}
        tutup={() => setDraf(null)}
        lebar="max-w-md"
      >
        {draf && (
          <div className="space-y-3">
            <Isian
              label="Nama Lengkap"
              value={draf.namaPengguna}
              onChange={(e) => setDraf({ ...draf, namaPengguna: e.target.value })}
            />
            <Isian
              label="Username"
              value={draf.username}
              autoCapitalize="none"
              onChange={(e) => setDraf({ ...draf, username: e.target.value })}
            />
            <Isian
              label={draf.idPengguna ? 'Kata Sandi Baru (kosongkan bila tidak diubah)' : 'Kata Sandi'}
              type="password"
              value={draf.kataSandi}
              onChange={(e) => setDraf({ ...draf, kataSandi: e.target.value })}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-teks-lembut">Peran</p>
              <div className="flex flex-wrap gap-3 rounded-xl bg-permukaan-2 p-3 text-sm">
                {peran.map((p) => (
                  <label key={p.id_peran} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draf.peran.includes(p.nama_peran)}
                      onChange={(e) => setDraf({
                        ...draf,
                        peran: e.target.checked
                          ? [...draf.peran, p.nama_peran]
                          : draf.peran.filter((x) => x !== p.nama_peran),
                      })}
                      className="h-4 w-4 accent-[var(--color-aksen)]"
                    />
                    {p.nama_peran}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draf.statusAktif}
                onChange={(e) => setDraf({ ...draf, statusAktif: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-aksen)]"
              />
              Akun aktif
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
