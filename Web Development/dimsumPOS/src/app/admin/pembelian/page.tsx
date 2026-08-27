'use client';

import { useCallback, useEffect, useState } from 'react';
import { Galat, Isian, Lencana, Memuat, Modal, Pilihan, Tombol } from '@/components/ui/dasar';
import { JudulHalaman, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatRupiah, formatWaktu } from '@/lib/klien';

/** Pembelian / barang masuk — Req 4.1–4.9 */

interface Pembelian {
  id_pembelian: string; nomor_faktur_pembelian: string; tanggal_pembelian: string;
  nama_pemasok: string | null; total_pembelian: string; status_pembelian: string;
  nama_pengguna: string; jumlah_baris: string;
}
interface Barang { id_barang: string; kode_barang: string; nama_barang: string; kode_satuan: string }
interface Pemasok { id_pemasok: string; nama_pemasok: string }
interface SatuanBarang {
  id_satuan_barang: string; id_satuan: string; kode_satuan: string;
  konversi_ke_satuan_dasar: string;
}
interface BarisForm {
  idBarang: string; idSatuan: string; jumlah: string; hargaBeliSatuan: string;
  pilihanSatuan: SatuanBarang[];
}

const BARIS_KOSONG: BarisForm = {
  idBarang: '', idSatuan: '', jumlah: '1', hargaBeliSatuan: '0', pilihanSatuan: [],
};

export default function HalamanPembelian() {
  const [daftar, setDaftar] = useState<Pembelian[] | null>(null);
  const [barang, setBarang] = useState<Barang[]>([]);
  const [pemasok, setPemasok] = useState<Pemasok[]>([]);
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const [faktur, setFaktur] = useState('');
  const [idPemasok, setIdPemasok] = useState('');
  const [diskon, setDiskon] = useState('0');
  const [pajak, setPajak] = useState('0');
  const [baris, setBaris] = useState<BarisForm[]>([{ ...BARIS_KOSONG }]);

  const muat = useCallback(() => {
    api<Pembelian[]>('/api/pembelian').then(setDaftar).catch((e: unknown) =>
      setGalat(e instanceof Error ? e.message : 'Gagal memuat pembelian.'));
  }, []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    api<Barang[]>('/api/barang').then(setBarang).catch(() => undefined);
    api<Pemasok[]>('/api/pemasok').then(setPemasok).catch(() => undefined);
  }, []);

  function bukaForm() {
    const kini = new Date();
    setFaktur(`PB-${kini.getFullYear()}${String(kini.getMonth() + 1).padStart(2, '0')}${String(kini.getDate()).padStart(2, '0')}-${String(kini.getHours()).padStart(2, '0')}${String(kini.getMinutes()).padStart(2, '0')}`);
    setIdPemasok('');
    setDiskon('0');
    setPajak('0');
    setBaris([{ ...BARIS_KOSONG }]);
    setGalat('');
    setFormTerbuka(true);
  }

  async function pilihBarang(indeks: number, idBarang: string) {
    const detail = await api<{ satuan: SatuanBarang[] }>(`/api/barang/${idBarang}`);
    setBaris((lama) => lama.map((b, i) => (i === indeks
      ? {
          ...b,
          idBarang,
          pilihanSatuan: detail.satuan,
          idSatuan: detail.satuan.find((s) => Number(s.konversi_ke_satuan_dasar) > 1)?.id_satuan
                 ?? detail.satuan[0]?.id_satuan
                 ?? '',
        }
      : b)));
  }

  const subtotal = baris.reduce(
    (n, b) => n + Number(b.jumlah || 0) * Number(b.hargaBeliSatuan || 0), 0,
  );
  const total = Math.max(subtotal - Number(diskon || 0), 0) + Number(pajak || 0);

  async function simpan() {
    setMenyimpan(true);
    setGalat('');
    try {
      await api('/api/pembelian', {
        method: 'POST',
        json: {
          nomorFaktur: faktur,
          idPemasok: idPemasok || null,
          diskon: diskon || '0',
          pajak: pajak || '0',
          status: 'SELESAI',
          detail: baris
            .filter((b) => b.idBarang && b.idSatuan)
            .map((b) => ({
              idBarang: b.idBarang, idSatuan: b.idSatuan,
              jumlah: b.jumlah, hargaBeliSatuan: b.hargaBeliSatuan,
            })),
        },
      });
      setFormTerbuka(false);
      muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan pembelian.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function batalkan(p: Pembelian) {
    const alasan = prompt(`Alasan pembatalan faktur ${p.nomor_faktur_pembelian}?`);
    if (!alasan) return;
    try {
      await api(`/api/pembelian/${p.id_pembelian}/batal`, { method: 'POST', json: { alasan } });
      muat();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal membatalkan.');
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Pembelian"
        keterangan="Catat barang masuk beserta harga belinya. Stok dan HPP rata-rata diperbarui otomatis."
        aksi={<Tombol varian="utama" onClick={bukaForm}>+ Pembelian Baru</Tombol>}
      />

      {galat && !formTerbuka && <div className="mb-3"><Galat pesan={galat} /></div>}

      {!daftar ? <Memuat /> : (
        <Tabel
          kepala={['Faktur', 'Pemasok', '~Baris', '~Total', 'Status', '~Aksi']}
          kosong={daftar.length === 0}
        >
          {daftar.map((p) => (
            <tr key={p.id_pembelian} className="hover:bg-permukaan-2">
              <Sel>
                <p className="font-medium">{p.nomor_faktur_pembelian}</p>
                <p className="text-xs text-teks-lembut">
                  {formatWaktu(p.tanggal_pembelian)} · {p.nama_pengguna}
                </p>
              </Sel>
              <Sel>{p.nama_pemasok ?? '—'}</Sel>
              <Sel kanan>{p.jumlah_baris}</Sel>
              <Sel kanan tebal>{formatRupiah(p.total_pembelian)}</Sel>
              <Sel>
                <Lencana warna={p.status_pembelian === 'SELESAI' ? 'sukses' : 'bahaya'}>
                  {p.status_pembelian}
                </Lencana>
              </Sel>
              <Sel kanan>
                {p.status_pembelian !== 'BATAL' && (
                  <Tombol varian="hantu" kecil onClick={() => batalkan(p)}>Batalkan</Tombol>
                )}
              </Sel>
            </tr>
          ))}
        </Tabel>
      )}

      <Modal
        judul="Pembelian Baru"
        terbuka={formTerbuka}
        tutup={() => setFormTerbuka(false)}
        lebar="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Isian
              label="Nomor Faktur"
              value={faktur}
              onChange={(e) => setFaktur(e.target.value)}
            />
            <Pilihan
              label="Pemasok"
              value={idPemasok}
              onChange={(e) => setIdPemasok(e.target.value)}
            >
              <option value="">— tanpa pemasok —</option>
              {pemasok.map((p) => (
                <option key={p.id_pemasok} value={p.id_pemasok}>{p.nama_pemasok}</option>
              ))}
            </Pilihan>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-teks-lembut">Daftar Barang</p>
            {baris.map((b, i) => (
              <div key={i} className="grid gap-2 rounded-xl bg-permukaan-2 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <select
                  value={b.idBarang}
                  onChange={(e) => pilihBarang(i, e.target.value)}
                  className="rounded-lg border border-garis bg-permukaan px-2 py-2 text-sm"
                >
                  <option value="">— pilih barang —</option>
                  {barang.map((x) => (
                    <option key={x.id_barang} value={x.id_barang}>
                      {x.nama_barang} ({x.kode_barang})
                    </option>
                  ))}
                </select>

                <select
                  value={b.idSatuan}
                  onChange={(e) => setBaris((l) => l.map((x, j) => (j === i ? { ...x, idSatuan: e.target.value } : x)))}
                  className="rounded-lg border border-garis bg-permukaan px-2 py-2 text-sm"
                >
                  {b.pilihanSatuan.length === 0 && <option value="">— satuan —</option>}
                  {b.pilihanSatuan.map((s) => (
                    <option key={s.id_satuan_barang} value={s.id_satuan}>
                      {s.kode_satuan} (isi {formatAngka(s.konversi_ke_satuan_dasar)})
                    </option>
                  ))}
                </select>

                <input
                  inputMode="decimal"
                  placeholder="Jumlah"
                  value={b.jumlah}
                  onChange={(e) => setBaris((l) => l.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))}
                  className="angka rounded-lg border border-garis bg-permukaan px-2 py-2 text-right text-sm"
                />
                <input
                  inputMode="decimal"
                  placeholder="Harga/satuan"
                  value={b.hargaBeliSatuan}
                  onChange={(e) => setBaris((l) => l.map((x, j) => (j === i ? { ...x, hargaBeliSatuan: e.target.value } : x)))}
                  className="angka rounded-lg border border-garis bg-permukaan px-2 py-2 text-right text-sm"
                />

                <Tombol
                  varian="hantu"
                  kecil
                  onClick={() => setBaris((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : l))}
                  aria-label="Hapus baris"
                >
                  ✕
                </Tombol>
              </div>
            ))}
            <Tombol varian="garis" kecil onClick={() => setBaris((l) => [...l, { ...BARIS_KOSONG }])}>
              + Tambah Baris
            </Tombol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Isian label="Diskon" inputMode="numeric" value={diskon} onChange={(e) => setDiskon(e.target.value)} />
            <Isian label="Pajak" inputMode="numeric" value={pajak} onChange={(e) => setPajak(e.target.value)} />
          </div>

          <div className="flex items-baseline justify-between rounded-xl bg-aksen-lembut px-4 py-3">
            <span className="text-sm font-medium">Total Pembelian</span>
            <span className="angka text-xl font-bold text-aksen-kuat">{formatRupiah(total)}</span>
          </div>

          {galat && <Galat pesan={galat} />}

          <div className="flex gap-2">
            <Tombol varian="garis" className="flex-1" onClick={() => setFormTerbuka(false)}>Batal</Tombol>
            <Tombol varian="utama" className="flex-1" onClick={simpan} disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Simpan & Tambah Stok'}
            </Tombol>
          </div>
        </div>
      </Modal>
    </div>
  );
}
