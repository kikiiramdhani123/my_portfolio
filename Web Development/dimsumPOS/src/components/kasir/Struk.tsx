'use client';

import { useEffect, useState } from 'react';
import { Tombol } from '@/components/ui/dasar';
import { api, formatRupiah, formatWaktu } from '@/lib/klien';

/** Struk transaksi — Req 6.9. Tata letak cetak 58 mm diatur di globals.css. */

export interface DataStruk {
  nomorTransaksi: string;
  tanggal: string;
  baris: { nama: string; jumlah: number; harga: number; subtotal: number }[];
  total: number;
  bayar: number;
  kembalian: number;
  metode: string;
}

export function Struk({ data, tutup }: { data: DataStruk; tutup: () => void }) {
  const [toko, setToko] = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ pengaturan: Record<string, string> }>('/api/katalog')
      .then((d) => setToko(d.pengaturan))
      .catch(() => undefined);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="animasi-masuk w-full max-w-sm rounded-2xl bg-permukaan p-5 shadow-xl">
        <div className="mb-4 text-center">
          <span className="text-3xl">✅</span>
          <h2 className="mt-1 text-lg font-semibold">Transaksi Berhasil</h2>
          <p className="angka mt-1 text-2xl font-bold text-sukses">
            Kembalian {formatRupiah(data.kembalian)}
          </p>
        </div>

        <div
          id="struk"
          className="max-h-[45dvh] overflow-y-auto rounded-xl border border-garis bg-latar p-3 text-xs"
        >
          <div className="text-center">
            <p className="text-sm font-bold">{toko.nama_toko ?? 'POS Dimsum & Es Teh'}</p>
            {toko.alamat_toko && <p>{toko.alamat_toko}</p>}
            {toko.telepon_toko && <p>{toko.telepon_toko}</p>}
          </div>

          <hr className="my-2 border-dashed border-garis" />

          <p>No. {data.nomorTransaksi}</p>
          <p>{formatWaktu(data.tanggal)}</p>

          <hr className="my-2 border-dashed border-garis" />

          <table className="w-full">
            <tbody>
              {data.baris.map((b, i) => (
                <tr key={i} className="align-top">
                  <td className="py-0.5">
                    {b.nama}
                    <br />
                    <span className="angka opacity-70">
                      {b.jumlah} × {formatRupiah(b.harga)}
                    </span>
                  </td>
                  <td className="angka py-0.5 text-right">{formatRupiah(b.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="my-2 border-dashed border-garis" />

          <table className="w-full">
            <tbody>
              <tr className="font-bold">
                <td>TOTAL</td>
                <td className="angka text-right">{formatRupiah(data.total)}</td>
              </tr>
              <tr>
                <td>Bayar ({data.metode})</td>
                <td className="angka text-right">{formatRupiah(data.bayar)}</td>
              </tr>
              <tr>
                <td>Kembali</td>
                <td className="angka text-right">{formatRupiah(data.kembalian)}</td>
              </tr>
            </tbody>
          </table>

          <hr className="my-2 border-dashed border-garis" />
          <p className="text-center">{toko.catatan_struk ?? 'Terima kasih!'}</p>
        </div>

        <div className="tanpa-cetak mt-4 flex gap-2">
          <Tombol varian="garis" className="flex-1" onClick={() => window.print()}>
            🖨️ Cetak
          </Tombol>
          <Tombol varian="utama" className="flex-1" onClick={tutup} autoFocus>
            Transaksi Baru
          </Tombol>
        </div>
      </div>
    </div>
  );
}
