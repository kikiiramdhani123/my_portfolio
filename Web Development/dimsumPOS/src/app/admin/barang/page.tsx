'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Galat, Isian, Lencana, Memuat, Modal, Pilihan, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatRupiah } from '@/lib/klien';

/** Master barang — Req 3.1–3.9 */

interface Barang {
  id_barang: string; kode_barang: string; nama_barang: string; jenis_barang: string;
  id_satuan_dasar: string; kode_satuan: string; dapat_dijual: boolean; dapat_dibeli: boolean;
  status_aktif: boolean; stok_minimum: string; emoji: string | null; warna_kartu: string | null;
  harga_jual: string; saldo: string;
}
interface Satuan { id_satuan: string; kode_satuan: string; nama_satuan: string }
interface SatuanBarang {
  id_satuan_barang: string; id_satuan: string; kode_satuan: string; nama_satuan: string;
  konversi_ke_satuan_dasar: string; harga_jual: string; barcode: string | null;
  adalah_satuan_default: boolean;
}

const JENIS = ['MAKANAN', 'MINUMAN', 'BAHAN', 'KEMASAN', 'LAINNYA'] as const;
const WARNA = ['amber', 'orange', 'rose', 'lime', 'violet', 'sky'] as const;

interface Draf {
  idBarang?: string;
  kodeBarang: string; namaBarang: string; jenisBarang: string; idSatuanDasar: string;
  dapatDijual: boolean; dapatDibeli: boolean; statusAktif: boolean;
  stokMinimum: string; hargaJual: string; emoji: string; warnaKartu: string;
}

const DRAF_KOSONG: Draf = {
  kodeBarang: '', namaBarang: '', jenisBarang: 'MAKANAN', idSatuanDasar: '',
  dapatDijual: true, dapatDibeli: false, statusAktif: true,
  stokMinimum: '0', hargaJual: '0', emoji: '', warnaKartu: 'amber',
};

export default function HalamanBarang() {
  const [barang, setBarang] = useState<Barang[] | null>(null);
  const [satuan, setSatuan] = useState<Satuan[]>([]);
  const [cari, setCari] = useState('');
  const [jenis, setJenis] = useState('');
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const [satuanBarang, setSatuanBarang] = useState<SatuanBarang[]>([]);
  const [satuanBaru, setSatuanBaru] = useState('');
  const [konversiBaru, setKonversiBaru] = useState('');
  const [galatSatuan, setGalatSatuan] = useState('');

  const muat = useCallback(() => {
    const p = new URLSearchParams();
    if (cari) p.set('cari', cari);
    if (jenis) p.set('jenis', jenis);
    api<Barang[]>(`/api/barang?${p}`).then(setBarang).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat barang.'));
  }, [cari, jenis]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { api<Satuan[]>('/api/satuan').then(setSatuan).catch(() => undefined); }, []);

  async function simpan() {
    if (!draf) return;
    setMenyimpan(true);
    setGalat('');
    try {
      const isi = {
        kodeBarang: draf.kodeBarang, namaBarang: draf.namaBarang, jenisBarang: draf.jenisBarang,
        idSatuanDasar: draf.idSatuanDasar, dapatDijual: draf.dapatDijual,
        dapatDibeli: draf.dapatDibeli, statusAktif: draf.statusAktif,
        stokMinimum: draf.stokMinimum || '0', hargaJual: draf.hargaJual || '0',
        emoji: draf.emoji || null, warnaKartu: draf.warnaKartu || null,
      };
      if (draf.idBarang) {
        await api(`/api/barang/${draf.idBarang}`, { method: 'PUT', json: isi });
      } else {
        await api('/api/barang', { method: 'POST', json: isi });
      }
      setDraf(null);
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(b: Barang) {
    if (!confirm(`Hapus ${b.nama_barang}?`)) return;
    try {
      await api(`/api/barang/${b.id_barang}`, { method: 'DELETE' });
      muat();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus.');
    }
  }

  async function muatSatuanBarang(idBarang: string) {
    const detail = await api<{ satuan: SatuanBarang[] }>(`/api/barang/${idBarang}`);
    setSatuanBarang(detail.satuan);
  }

  async function tambahSatuanAlternatif() {
    if (!draf?.idBarang || !satuanBaru || !konversiBaru) return;
    setGalatSatuan('');
    try {
      await api(`/api/barang/${draf.idBarang}/satuan`, {
        method: 'POST',
        json: { idSatuan: satuanBaru, konversiKeSatuanDasar: konversiBaru, hargaJual: '0' },
      });
      setSatuanBaru('');
      setKonversiBaru('');
      await muatSatuanBarang(draf.idBarang);
    } catch (e) {
      setGalatSatuan(e instanceof Error ? e.message : 'Gagal menambah satuan.');
    }
  }

  async function hapusSatuanAlternatif(sb: SatuanBarang) {
    if (!draf?.idBarang) return;
    if (!confirm(`Hapus satuan ${sb.kode_satuan} dari barang ini?`)) return;
    try {
      await api(`/api/barang/${draf.idBarang}/satuan/${sb.id_satuan_barang}`, { method: 'DELETE' });
      await muatSatuanBarang(draf.idBarang);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus satuan.');
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Master Barang"
        keterangan="Produk jual, bahan baku, dan kemasan. Menu baru cukup ditambahkan di sini."
        aksi={
          <Tombol
            varian="utama"
            onClick={() => setDraf({ ...DRAF_KOSONG, idSatuanDasar: satuan[0]?.id_satuan ?? '' })}
          >
            + Barang Baru
          </Tombol>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama atau kode…"
          className="min-w-[200px] flex-1 rounded-xl border border-garis bg-permukaan px-3 py-2 text-sm"
        />
        <select
          value={jenis}
          onChange={(e) => setJenis(e.target.value)}
          className="rounded-xl border border-garis bg-permukaan px-3 py-2 text-sm"
        >
          <option value="">Semua jenis</option>
          {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {galat && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!barang ? <Memuat /> : (
        <Tabel
          kepala={['Barang', 'Jenis', '~Harga Jual', '~Stok', 'Status', '~Aksi']}
          kosong={barang.length === 0}
        >
          {barang.map((b) => (
            <tr key={b.id_barang} className="hover:bg-permukaan-2">
              <Sel>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{b.emoji ?? '📦'}</span>
                  <div>
                    <p className="font-medium">{b.nama_barang}</p>
                    <p className="text-xs text-teks-lembut">{b.kode_barang} · {b.kode_satuan}</p>
                  </div>
                </div>
              </Sel>
              <Sel><Lencana>{b.jenis_barang}</Lencana></Sel>
              <Sel kanan>{b.dapat_dijual ? formatRupiah(b.harga_jual) : '—'}</Sel>
              <Sel kanan tebal>{formatAngka(b.saldo)}</Sel>
              <Sel>
                {b.status_aktif
                  ? <Lencana warna="sukses">Aktif</Lencana>
                  : <Lencana warna="bahaya">Nonaktif</Lencana>}
              </Sel>
              <Sel kanan>
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/admin/stok/${b.id_barang}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-teks-lembut hover:bg-permukaan"
                  >
                    Kartu
                  </Link>
                  <Tombol
                    varian="hantu"
                    kecil
                    onClick={() => {
                      setDraf({
                        idBarang: b.id_barang, kodeBarang: b.kode_barang, namaBarang: b.nama_barang,
                        jenisBarang: b.jenis_barang, idSatuanDasar: b.id_satuan_dasar,
                        dapatDijual: b.dapat_dijual, dapatDibeli: b.dapat_dibeli,
                        statusAktif: b.status_aktif, stokMinimum: b.stok_minimum,
                        hargaJual: b.harga_jual, emoji: b.emoji ?? '', warnaKartu: b.warna_kartu ?? 'amber',
                      });
                      setSatuanBaru('');
                      setKonversiBaru('');
                      setGalatSatuan('');
                      muatSatuanBarang(b.id_barang);
                    }}
                  >
                    Ubah
                  </Tombol>
                  <Tombol varian="hantu" kecil onClick={() => hapus(b)}>Hapus</Tombol>
                </div>
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal
        judul={draf?.idBarang ? 'Ubah Barang' : 'Barang Baru'}
        terbuka={draf !== null}
        tutup={() => setDraf(null)}
      >
        {draf && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Isian
                label="Kode Barang"
                value={draf.kodeBarang}
                onChange={(e) => setDraf({ ...draf, kodeBarang: e.target.value.toUpperCase() })}
              />
              <Isian
                label="Nama Barang"
                value={draf.namaBarang}
                onChange={(e) => setDraf({ ...draf, namaBarang: e.target.value })}
              />
              <Pilihan
                label="Jenis"
                value={draf.jenisBarang}
                onChange={(e) => setDraf({ ...draf, jenisBarang: e.target.value })}
              >
                {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
              </Pilihan>
              <Pilihan
                label="Satuan Dasar"
                value={draf.idSatuanDasar}
                onChange={(e) => setDraf({ ...draf, idSatuanDasar: e.target.value })}
              >
                <option value="">— pilih —</option>
                {satuan.map((s) => (
                  <option key={s.id_satuan} value={s.id_satuan}>
                    {s.kode_satuan} — {s.nama_satuan}
                  </option>
                ))}
              </Pilihan>
              <Isian
                label="Harga Jual (per satuan dasar)"
                inputMode="numeric"
                value={draf.hargaJual}
                onChange={(e) => setDraf({ ...draf, hargaJual: e.target.value })}
              />
              <Isian
                label="Stok Minimum"
                inputMode="numeric"
                value={draf.stokMinimum}
                onChange={(e) => setDraf({ ...draf, stokMinimum: e.target.value })}
              />
              <Isian
                label="Emoji Kartu Kasir"
                value={draf.emoji}
                maxLength={4}
                placeholder="🥟"
                onChange={(e) => setDraf({ ...draf, emoji: e.target.value })}
              />
              <Pilihan
                label="Warna Kartu"
                value={draf.warnaKartu}
                onChange={(e) => setDraf({ ...draf, warnaKartu: e.target.value })}
              >
                {WARNA.map((w) => <option key={w} value={w}>{w}</option>)}
              </Pilihan>
            </div>

            <div className="flex flex-wrap gap-4 rounded-xl bg-permukaan-2 p-3 text-sm">
              {([
                ['dapatDijual', 'Dapat dijual'],
                ['dapatDibeli', 'Dapat dibeli'],
                ['statusAktif', 'Aktif'],
              ] as const).map(([kunci, label]) => (
                <label key={kunci} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draf[kunci]}
                    onChange={(e) => setDraf({ ...draf, [kunci]: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-aksen)]"
                  />
                  {label}
                </label>
              ))}
            </div>

            {draf.idBarang && (
              <div className="rounded-xl border border-garis p-3">
                <p className="mb-1 text-sm font-medium">Satuan Alternatif</p>
                <p className="mb-2 text-xs text-teks-lembut">
                  Untuk barang yang dibeli atau dihitung dalam satuan lain, mis. 1 PAX = 50 PCS.
                  Konversi selalu ke satuan dasar ({satuan.find((s) => s.id_satuan === draf.idSatuanDasar)?.kode_satuan ?? '—'}).
                </p>

                {satuanBarang.filter((s) => !s.adalah_satuan_default).length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {satuanBarang.filter((s) => !s.adalah_satuan_default).map((s) => (
                      <li
                        key={s.id_satuan_barang}
                        className="flex items-center justify-between rounded-lg bg-permukaan-2 px-2.5 py-1.5 text-sm"
                      >
                        <span>
                          1 <strong>{s.kode_satuan}</strong> = {formatAngka(s.konversi_ke_satuan_dasar)}{' '}
                          {satuan.find((x) => x.id_satuan === draf.idSatuanDasar)?.kode_satuan}
                        </span>
                        <Tombol varian="hantu" kecil onClick={() => hapusSatuanAlternatif(s)}>Hapus</Tombol>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={satuanBaru}
                    onChange={(e) => setSatuanBaru(e.target.value)}
                    className="rounded-lg border border-garis bg-permukaan px-2 py-2 text-sm"
                  >
                    <option value="">— satuan —</option>
                    {satuan
                      .filter((s) => !satuanBarang.some((sb) => sb.id_satuan === s.id_satuan))
                      .map((s) => <option key={s.id_satuan} value={s.id_satuan}>{s.kode_satuan}</option>)}
                  </select>
                  <input
                    inputMode="decimal"
                    placeholder="Isi (mis. 50)"
                    value={konversiBaru}
                    onChange={(e) => setKonversiBaru(e.target.value)}
                    className="angka rounded-lg border border-garis bg-permukaan px-2 py-2 text-sm"
                  />
                  <Tombol
                    varian="garis"
                    kecil
                    onClick={tambahSatuanAlternatif}
                    disabled={!satuanBaru || !konversiBaru}
                  >
                    + Tambah
                  </Tombol>
                </div>
                {galatSatuan && <div className="mt-2"><Galat pesan={galatSatuan} /></div>}
              </div>
            )}

            {galat && <Galat pesan={galat} />}

            <div className="flex gap-2 pt-1">
              <Tombol varian="garis" className="flex-1" onClick={() => setDraf(null)}>Batal</Tombol>
              <Tombol varian="utama" className="flex-1" onClick={simpan} disabled={menyimpan}>
                {menyimpan ? 'Menyimpan…' : 'Simpan'}
              </Tombol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
