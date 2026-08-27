'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Galat, Kartu, Lencana, Memuat } from '@/components/ui/dasar';
import { FilterTanggal, JudulHalaman, KartuKpi, Sel, Tabel } from '@/components/admin/umum';
import { api, formatAngka, formatRupiah, hariIni } from '@/lib/klien';

/** Dasbor pemilik — Req 9.1 */

interface Ringkasan {
  omzet: string; jumlah_transaksi: string; total_hpp: string;
  laba_kotor: string; total_biaya: string; laba_bersih: string; item_terjual: string;
}
interface Harian { tanggal: string; omzet: string; laba_kotor: string; transaksi: string }
interface Terlaris { id_barang: string; nama_barang: string; qty: string; omzet: string; laba_kotor: string }
interface Stok {
  id_barang: string; nama_barang: string; kode_satuan: string;
  saldo: string; stok_minimum: string; menipis: boolean;
}

export default function Dasbor() {
  const [dari, setDari] = useState(hariIni());
  const [sampai, setSampai] = useState(hariIni());
  const [data, setData] = useState<{ total: Ringkasan; harian: Harian[]; terlaris: Terlaris[] } | null>(null);
  const [stok, setStok] = useState<Stok[]>([]);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    setData(null);
    api<{ hasil: { total: Ringkasan; harian: Harian[]; terlaris: Terlaris[] } }>(
      `/api/laporan/ringkasan?dari=${dari}&sampai=${sampai}`,
    )
      .then((d) => setData(d.hasil))
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Gagal memuat dasbor.'));
  }, [dari, sampai]);

  useEffect(() => {
    api<Stok[]>('/api/stok').then((d) => setStok(d.filter((s) => s.menipis))).catch(() => undefined);
  }, []);

  const puncak = Math.max(...(data?.harian ?? []).map((h) => Number(h.omzet)), 1);

  return (
    <div className="p-4 lg:p-6">
      <JudulHalaman
        judul="Dasbor"
        keterangan="Ringkasan performa toko pada periode terpilih."
      />

      <FilterTanggal
        dari={dari}
        sampai={sampai}
        ubah={(a, b) => { setDari(a); setSampai(b); }}
      />

      {galat && <Galat pesan={galat} />}
      {!data ? <Memuat /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KartuKpi
              label="Omzet"
              nilai={formatRupiah(data.total.omzet)}
              keterangan={`${data.total.jumlah_transaksi} transaksi · ${formatAngka(data.total.item_terjual)} item`}
              warna="aksen"
            />
            <KartuKpi
              label="Harga Pokok (HPP)"
              nilai={formatRupiah(data.total.total_hpp)}
              keterangan="Bahan + kemasan terpakai"
            />
            <KartuKpi
              label="Laba Kotor"
              nilai={formatRupiah(data.total.laba_kotor)}
              keterangan="Omzet − HPP"
              warna="sukses"
            />
            <KartuKpi
              label="Laba Bersih"
              nilai={formatRupiah(data.total.laba_bersih)}
              keterangan={`Setelah biaya ${formatRupiah(data.total.total_biaya)}`}
              warna={Number(data.total.laba_bersih) >= 0 ? 'sukses' : 'bahaya'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Kartu>
              <h2 className="mb-3 font-semibold">Omzet per Hari</h2>
              {data.harian.length === 0 ? (
                <p className="py-8 text-center text-sm text-teks-lembut">Belum ada data.</p>
              ) : (
                <div className="flex h-44 items-end gap-1.5">
                  {data.harian.map((h) => (
                    <div key={h.tanggal} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-aksen/80 transition-all hover:bg-aksen"
                        style={{ height: `${Math.max((Number(h.omzet) / puncak) * 100, 2)}%` }}
                        title={`${h.tanggal}: ${formatRupiah(h.omzet)}`}
                      />
                      <span className="text-[10px] text-teks-lembut">{h.tanggal.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Kartu>

            <Kartu>
              <h2 className="mb-3 font-semibold">Produk Terlaris</h2>
              {data.terlaris.length === 0 ? (
                <p className="py-8 text-center text-sm text-teks-lembut">Belum ada penjualan.</p>
              ) : (
                <ul className="space-y-2">
                  {data.terlaris.map((t, i) => (
                    <li key={t.id_barang} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-permukaan-2 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.nama_barang}</span>
                      <span className="angka text-sm text-teks-lembut">{formatAngka(t.qty)}×</span>
                      <span className="angka text-sm font-semibold">{formatRupiah(t.omzet)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Kartu>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                Stok Menipis {stok.length > 0 && <Lencana warna="bahaya">{stok.length}</Lencana>}
              </h2>
              <Link href="/admin/stok" className="text-sm font-medium text-aksen">
                Lihat kartu stok →
              </Link>
            </div>
            <Tabel kepala={['Barang', '~Stok', '~Minimum', 'Status']} kosong={stok.length === 0}>
              {stok.map((s) => (
                <tr key={s.id_barang}>
                  <Sel>
                    <Link href={`/admin/stok/${s.id_barang}`} className="font-medium hover:underline">
                      {s.nama_barang}
                    </Link>
                  </Sel>
                  <Sel kanan tebal>{formatAngka(s.saldo)} {s.kode_satuan}</Sel>
                  <Sel kanan>{formatAngka(s.stok_minimum)}</Sel>
                  <Sel>
                    <Lencana warna={Number(s.saldo) <= 0 ? 'bahaya' : 'peringatan'}>
                      {Number(s.saldo) <= 0 ? 'Habis' : 'Menipis'}
                    </Lencana>
                  </Sel>
                </tr>
              ))}
            </Tabel>
          </div>
        </div>
      )}
    </div>
  );
}
