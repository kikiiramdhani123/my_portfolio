'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Galat, Kosong, Memuat, Tombol, gabung } from '@/components/ui/dasar';
import { DialogPembayaran } from './DialogPembayaran';
import { Struk, type DataStruk } from './Struk';
import { api, formatRupiah } from '@/lib/klien';

/** Layar penjualan — Requirement 6.1–6.4, 6.9, 6.11, 10.2, 10.3 · Design §6.1 */

interface SatuanJual {
  idSatuanBarang: string;
  idSatuan: string;
  kodeSatuan: string;
  konversi: string;
  hargaJual: string;
  barcode: string | null;
  utama: boolean;
}

interface Produk {
  idBarang: string;
  kodeBarang: string;
  namaBarang: string;
  jenisBarang: string;
  emoji: string | null;
  warnaKartu: string | null;
  satuan: SatuanJual[];
}

export interface BarisKeranjang {
  kunci: string;
  idBarang: string;
  idSatuan: string;
  nama: string;
  kodeSatuan: string;
  harga: number;
  jumlah: number;
  diskonBaris: number;
  emoji: string | null;
}

const KUNCI_SIMPANAN = 'pos_keranjang';

const WARNA_KARTU: Record<string, string> = {
  amber: 'from-amber-100 to-amber-50 dark:from-amber-950 dark:to-amber-900',
  orange: 'from-orange-100 to-orange-50 dark:from-orange-950 dark:to-orange-900',
  rose: 'from-rose-100 to-rose-50 dark:from-rose-950 dark:to-rose-900',
  lime: 'from-lime-100 to-lime-50 dark:from-lime-950 dark:to-lime-900',
  violet: 'from-violet-100 to-violet-50 dark:from-violet-950 dark:to-violet-900',
  sky: 'from-sky-100 to-sky-50 dark:from-sky-950 dark:to-sky-900',
};

export function LayarKasir() {
  const [produk, setProduk] = useState<Produk[] | null>(null);
  const [galatMuat, setGalatMuat] = useState('');
  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState('SEMUA');
  const [keranjang, setKeranjang] = useState<BarisKeranjang[]>([]);
  const [bayarTerbuka, setBayarTerbuka] = useState(false);
  const [keranjangTerbuka, setKeranjangTerbuka] = useState(false);
  const [struk, setStruk] = useState<DataStruk | null>(null);
  const kotakCari = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ produk: Produk[] }>('/api/katalog')
      .then((d) => setProduk(d.produk))
      .catch((e: unknown) => setGalatMuat(e instanceof Error ? e.message : 'Gagal memuat katalog.'));
  }, []);

  // Keranjang bertahan bila halaman ter-refresh atau sesi putus (Design §7).
  useEffect(() => {
    const tersimpan = localStorage.getItem(KUNCI_SIMPANAN);
    if (tersimpan) {
      try { setKeranjang(JSON.parse(tersimpan) as BarisKeranjang[]); } catch { /* abaikan */ }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(KUNCI_SIMPANAN, JSON.stringify(keranjang));
  }, [keranjang]);

  const kategoriTersedia = useMemo(() => {
    const daftar = [...new Set((produk ?? []).map((p) => p.jenisBarang))];
    return ['SEMUA', ...daftar];
  }, [produk]);

  const terlihat = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return (produk ?? []).filter((p) => {
      const cocokKategori = kategori === 'SEMUA' || p.jenisBarang === kategori;
      const cocokCari = !kunci
        || p.namaBarang.toLowerCase().includes(kunci)
        || p.kodeBarang.toLowerCase().includes(kunci)
        || p.satuan.some((s) => s.barcode?.toLowerCase() === kunci);
      return cocokKategori && cocokCari;
    });
  }, [produk, cari, kategori]);

  const tambah = useCallback((p: Produk, s: SatuanJual) => {
    const kunci = `${p.idBarang}-${s.idSatuan}`;
    setKeranjang((lama) => {
      const ada = lama.find((b) => b.kunci === kunci);
      if (ada) {
        return lama.map((b) => (b.kunci === kunci ? { ...b, jumlah: b.jumlah + 1 } : b));
      }
      return [...lama, {
        kunci,
        idBarang: p.idBarang,
        idSatuan: s.idSatuan,
        nama: p.namaBarang,
        kodeSatuan: s.kodeSatuan,
        harga: Number(s.hargaJual),
        jumlah: 1,
        diskonBaris: 0,
        emoji: p.emoji,
      }];
    });
  }, []);

  const ubahJumlah = (kunci: string, delta: number) =>
    setKeranjang((lama) => lama
      .map((b) => (b.kunci === kunci ? { ...b, jumlah: b.jumlah + delta } : b))
      .filter((b) => b.jumlah > 0));

  const hapusBaris = (kunci: string) =>
    setKeranjang((lama) => lama.filter((b) => b.kunci !== kunci));

  const subtotal = keranjang.reduce(
    (jumlah, b) => jumlah + Math.max(b.harga * b.jumlah - b.diskonBaris, 0), 0,
  );
  const jumlahItem = keranjang.reduce((n, b) => n + b.jumlah, 0);

  // Req 6.x — pintasan papan tik untuk laptop (Design §6.1).
  useEffect(() => {
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === 'F2' && keranjang.length > 0) { e.preventDefault(); setBayarTerbuka(true); }
      if (e.key === 'F3') { e.preventDefault(); kotakCari.current?.focus(); }
    };
    window.addEventListener('keydown', padaTombol);
    return () => window.removeEventListener('keydown', padaTombol);
  }, [keranjang.length]);

  function selesai(data: DataStruk) {
    setKeranjang([]);
    setBayarTerbuka(false);
    setKeranjangTerbuka(false);
    setStruk(data);
  }

  if (galatMuat) return <div className="p-4"><Galat pesan={galatMuat} /></div>;
  if (!produk) return <Memuat pesan="Memuat katalog…" />;

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ── Katalog produk ── */}
        <section className="flex flex-1 flex-col overflow-hidden">
          <div className="tanpa-cetak flex flex-col gap-2 border-b border-garis bg-permukaan px-3 py-2">
            <input
              ref={kotakCari}
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari produk atau scan barcode…  (F3)"
              className="w-full rounded-xl border border-garis bg-latar px-3 py-2.5 text-sm focus:border-aksen focus:outline-none"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {kategoriTersedia.map((k) => (
                <button
                  key={k}
                  onClick={() => setKategori(k)}
                  className={gabung(
                    'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    kategori === k
                      ? 'bg-aksen text-white'
                      : 'bg-permukaan-2 text-teks-lembut hover:bg-garis',
                  )}
                >
                  {k === 'SEMUA' ? 'Semua' : k.charAt(0) + k.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pb-28 lg:pb-3">
            {terlihat.length === 0 ? (
              <Kosong pesan="Tidak ada produk yang cocok." ikon="🔍" />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {terlihat.map((p) => {
                  const utama = p.satuan.find((s) => s.utama) ?? p.satuan[0]!;
                  return (
                    <button
                      key={p.idBarang}
                      onClick={() => tambah(p, utama)}
                      className={gabung(
                        'sentuh flex flex-col gap-1 rounded-[var(--radius-kartu)] border border-garis',
                        'bg-gradient-to-br p-3 text-left transition active:scale-[0.97]',
                        WARNA_KARTU[p.warnaKartu ?? ''] ?? 'from-permukaan-2 to-permukaan',
                      )}
                    >
                      <span className="text-2xl">{p.emoji ?? '🍽️'}</span>
                      <span className="line-clamp-2 text-sm font-semibold leading-tight">
                        {p.namaBarang}
                      </span>
                      <span className="angka mt-auto text-sm font-bold text-aksen-kuat">
                        {formatRupiah(utama.hargaJual)}
                        <span className="ml-1 text-[10px] font-normal text-teks-lembut">
                          /{utama.kodeSatuan}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Keranjang: panel kanan (desktop) / bottom sheet (HP) ── */}
        <aside
          className={gabung(
            'tanpa-cetak flex flex-col border-garis bg-permukaan',
            'lg:w-[380px] lg:border-l',
            'fixed inset-x-0 bottom-0 top-auto z-40 max-h-[85dvh] rounded-t-2xl border-t shadow-2xl',
            'lg:static lg:max-h-none lg:rounded-none lg:shadow-none',
            keranjangTerbuka ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="flex items-center justify-between border-b border-garis px-4 py-3">
            <h2 className="font-semibold">Keranjang</h2>
            <div className="flex items-center gap-1">
              {keranjang.length > 0 && (
                <Tombol varian="hantu" kecil onClick={() => setKeranjang([])}>Kosongkan</Tombol>
              )}
              <Tombol
                varian="hantu"
                kecil
                className="lg:hidden"
                onClick={() => setKeranjangTerbuka(false)}
              >
                ▼
              </Tombol>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {keranjang.length === 0 ? (
              <Kosong pesan="Ketuk produk untuk menambahkan." ikon="🛒" />
            ) : (
              <ul className="space-y-2">
                {keranjang.map((b) => (
                  <li key={b.kunci} className="rounded-xl bg-permukaan-2 p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{b.emoji ?? '🍽️'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.nama}</p>
                        <p className="angka text-xs text-teks-lembut">
                          {formatRupiah(b.harga)} / {b.kodeSatuan}
                        </p>
                      </div>
                      <button
                        onClick={() => hapusBaris(b.kunci)}
                        className="sentuh px-1 text-teks-lembut hover:text-bahaya"
                        aria-label={`Hapus ${b.nama}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => ubahJumlah(b.kunci, -1)}
                        className="sentuh h-9 w-9 rounded-lg bg-permukaan text-lg font-bold"
                        aria-label="Kurangi"
                      >
                        −
                      </button>
                      <span className="angka w-8 text-center font-semibold">{b.jumlah}</span>
                      <button
                        onClick={() => ubahJumlah(b.kunci, 1)}
                        className="sentuh h-9 w-9 rounded-lg bg-permukaan text-lg font-bold"
                        aria-label="Tambah"
                      >
                        +
                      </button>
                      <span className="angka ml-auto font-semibold">
                        {formatRupiah(Math.max(b.harga * b.jumlah - b.diskonBaris, 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-garis p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-teks-lembut">Total {jumlahItem} item</span>
              <span className="angka text-2xl font-bold">{formatRupiah(subtotal)}</span>
            </div>
            <Tombol
              varian="utama"
              className="w-full py-4 text-base"
              disabled={keranjang.length === 0}
              onClick={() => setBayarTerbuka(true)}
            >
              Bayar <span className="hidden text-xs opacity-70 lg:inline">(F2)</span>
            </Tombol>
          </div>
        </aside>
      </div>

      {/* Bilah total menempel di bawah untuk layar HP */}
      {!keranjangTerbuka && (
        <button
          onClick={() => setKeranjangTerbuka(true)}
          className={gabung(
            'tanpa-cetak fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-garis',
            'bg-aksen px-4 py-3 text-white shadow-2xl lg:hidden',
          )}
        >
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-sm font-bold">{jumlahItem}</span>
          <span className="text-sm font-medium">Lihat Keranjang</span>
          <span className="angka ml-auto text-lg font-bold">{formatRupiah(subtotal)}</span>
        </button>
      )}

      <DialogPembayaran
        terbuka={bayarTerbuka}
        tutup={() => setBayarTerbuka(false)}
        keranjang={keranjang}
        total={subtotal}
        selesai={selesai}
      />

      {struk && <Struk data={struk} tutup={() => setStruk(null)} />}
    </>
  );
}
