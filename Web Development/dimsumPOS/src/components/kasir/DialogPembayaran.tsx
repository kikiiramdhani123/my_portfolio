'use client';

import { useEffect, useMemo, useState } from 'react';
import { Galat, Modal, Tombol, gabung } from '@/components/ui/dasar';
import { api, formatRupiah } from '@/lib/klien';
import type { BarisKeranjang } from './LayarKasir';
import type { DataStruk } from './Struk';

/** Dialog pembayaran — Requirement 6.5, 6.6, 6.9, 6.14 · Design §6.2 */

type Metode = 'TUNAI' | 'QRIS' | 'TRANSFER';

export function DialogPembayaran({ terbuka, tutup, keranjang, total, selesai }: {
  terbuka: boolean;
  tutup: () => void;
  keranjang: BarisKeranjang[];
  total: number;
  selesai: (struk: DataStruk) => void;
}) {
  const [metode, setMetode] = useState<Metode>('TUNAI');
  const [bayar, setBayar] = useState('');
  const [galat, setGalat] = useState('');
  const [memproses, setMemproses] = useState(false);
  const [kunciIdempoten, setKunciIdempoten] = useState('');

  useEffect(() => {
    if (!terbuka) return;
    setMetode('TUNAI');
    setBayar('');
    setGalat('');
    // Req 6.14 — satu kunci per pembukaan dialog; retry jaringan tidak menggandakan transaksi.
    setKunciIdempoten(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  }, [terbuka]);

  const nominalBayar = metode === 'TUNAI' ? Number(bayar || 0) : total;
  const kembalian = Math.max(nominalBayar - total, 0);
  const kurang = metode === 'TUNAI' && nominalBayar < total;

  const saranNominal = useMemo(() => {
    const kelipatan = [total, 20_000, 50_000, 100_000, 150_000, 200_000];
    return [...new Set(kelipatan.filter((n) => n >= total))].slice(0, 5);
  }, [total]);

  async function konfirmasi() {
    if (kurang) { setGalat('Jumlah bayar kurang dari total belanja.'); return; }
    setGalat('');
    setMemproses(true);
    try {
      const hasil = await api<{ idPenjualan: string; nomorTransaksi: string; total: string; kembalian: string }>(
        '/api/penjualan',
        {
          method: 'POST',
          json: {
            detail: keranjang.map((b) => ({
              idBarang: b.idBarang,
              idSatuan: b.idSatuan,
              jumlah: String(b.jumlah),
              diskonBaris: String(b.diskonBaris),
            })),
            metodePembayaran: metode,
            jumlahBayar: String(nominalBayar),
            idempotencyKey: kunciIdempoten,
          },
        },
      );

      selesai({
        nomorTransaksi: hasil.nomorTransaksi,
        tanggal: new Date().toISOString(),
        baris: keranjang.map((b) => ({
          nama: b.nama,
          jumlah: b.jumlah,
          harga: b.harga,
          subtotal: Math.max(b.harga * b.jumlah - b.diskonBaris, 0),
        })),
        total,
        bayar: nominalBayar,
        kembalian,
        metode,
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan transaksi.');
    } finally {
      setMemproses(false);
    }
  }

  function tekanAngka(digit: string) {
    setBayar((lama) => {
      if (digit === 'hapus') return lama.slice(0, -1);
      if (digit === '000') return lama === '' ? '' : `${lama}000`;
      return `${lama}${digit}`.replace(/^0+(?=\d)/, '');
    });
  }

  return (
    <Modal judul="Pembayaran" terbuka={terbuka} tutup={tutup} lebar="max-w-md">
      <div className="space-y-4">
        <div className="rounded-xl bg-aksen-lembut p-4 text-center">
          <p className="text-xs font-medium text-teks-lembut">Total Belanja</p>
          <p className="angka text-3xl font-bold text-aksen-kuat">{formatRupiah(total)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['TUNAI', 'QRIS', 'TRANSFER'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetode(m)}
              className={gabung(
                'sentuh rounded-xl px-2 py-2.5 text-sm font-semibold transition',
                metode === m ? 'bg-aksen text-white' : 'bg-permukaan-2 text-teks-lembut',
              )}
            >
              {m === 'TUNAI' ? '💵 Tunai' : m === 'QRIS' ? '📱 QRIS' : '🏦 Transfer'}
            </button>
          ))}
        </div>

        {metode === 'TUNAI' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {saranNominal.map((n, i) => (
                <button
                  key={n}
                  onClick={() => setBayar(String(n))}
                  className="sentuh rounded-lg border border-garis px-3 py-1.5 text-sm font-medium hover:bg-permukaan-2"
                >
                  {i === 0 ? 'Uang Pas' : formatRupiah(n)}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-garis p-3">
              <p className="text-xs text-teks-lembut">Uang Diterima</p>
              <p className="angka text-2xl font-bold">{formatRupiah(Number(bayar || 0))}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'hapus'].map((t) => (
                <button
                  key={t}
                  onClick={() => tekanAngka(t)}
                  className="sentuh rounded-xl bg-permukaan-2 py-3.5 text-lg font-semibold hover:bg-garis"
                >
                  {t === 'hapus' ? '⌫' : t}
                </button>
              ))}
            </div>

            <div className="flex items-baseline justify-between rounded-xl bg-permukaan-2 px-4 py-3">
              <span className="text-sm font-medium text-teks-lembut">Kembalian</span>
              <span className={gabung('angka text-xl font-bold', kurang ? 'text-bahaya' : 'text-sukses')}>
                {kurang ? `Kurang ${formatRupiah(total - nominalBayar)}` : formatRupiah(kembalian)}
              </span>
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-permukaan-2 px-4 py-3 text-sm text-teks-lembut">
            Pastikan pembayaran {metode} sudah diterima sebelum menekan tombol Selesaikan.
          </p>
        )}

        {galat && <Galat pesan={galat} />}

        <Tombol
          varian="utama"
          className="w-full py-4 text-base"
          disabled={memproses || kurang}
          onClick={konfirmasi}
        >
          {memproses ? 'Menyimpan…' : 'Selesaikan Transaksi'}
        </Tombol>
      </div>
    </Modal>
  );
}
