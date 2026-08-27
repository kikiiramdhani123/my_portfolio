import 'server-only';
import { query } from './db';
import { requireUser, type Sesi } from './auth';
import { GalatAkses } from './galat';

/** Requirement: 2.1–2.8 · Design §4 */

const KODE_HAK_AKSES = [
  'DASBOR',
  'MASTER_BARANG',
  'MASTER_PEMASOK',
  'PEMBELIAN',
  'RESEP',
  'STOK',
  'BIAYA',
  'LAPORAN_LABA',
  'PENJUALAN',
  'PENJUALAN_BATAL',
  'PENGGUNA',
] as const;

type KodeHakAkses = (typeof KODE_HAK_AKSES)[number];
type Aksi = 'lihat' | 'tambah' | 'ubah' | 'hapus';

interface Izin {
  lihat: boolean;
  tambah: boolean;
  ubah: boolean;
  hapus: boolean;
}

type PetaIzin = Partial<Record<KodeHakAkses, Izin>>;

interface BarisIzin {
  kode_hak_akses: KodeHakAkses;
  boleh_lihat: boolean;
  boleh_tambah: boolean;
  boleh_ubah: boolean;
  boleh_hapus: boolean;
}

/**
 * Muat izin efektif pengguna (gabungan seluruh perannya — OR per aksi).
 * Selalu dibaca dari DB agar perubahan izin berlaku pada permintaan berikutnya (Req 2.6).
 */
export async function muatIzin(idPengguna: string | number): Promise<PetaIzin> {
  const baris = await query<BarisIzin>(
    `SELECT h.kode_hak_akses,
            bool_or(pha.boleh_lihat)  AS boleh_lihat,
            bool_or(pha.boleh_tambah) AS boleh_tambah,
            bool_or(pha.boleh_ubah)   AS boleh_ubah,
            bool_or(pha.boleh_hapus)  AS boleh_hapus
       FROM pengguna_peran pp
       JOIN peran_hak_akses pha ON pha.id_peran = pp.id_peran
       JOIN hak_akses h         ON h.id_hak_akses = pha.id_hak_akses
      WHERE pp.id_pengguna = $1
      GROUP BY h.kode_hak_akses`,
    [idPengguna],
  );

  const peta: PetaIzin = {};
  for (const b of baris) {
    peta[b.kode_hak_akses] = {
      lihat: b.boleh_lihat,
      tambah: b.boleh_tambah,
      ubah: b.boleh_ubah,
      hapus: b.boleh_hapus,
    };
  }
  return peta;
}

export function punyaIzin(peta: PetaIzin, kode: KodeHakAkses, aksi: Aksi): boolean {
  return peta[kode]?.[aksi] === true;
}

interface Konteks {
  sesi: Sesi;
  izin: PetaIzin;
}

/** Ambil sesi + izin. Melempar GalatAkses(401) bila belum login. */
async function konteks(): Promise<Konteks> {
  const sesi = await requireUser();
  return { sesi, izin: await muatIzin(sesi.idPengguna) };
}

/**
 * Penjaga utama setiap Route Handler / Server Action (Req 2.4).
 * Menyembunyikan menu di UI bukan pengamanan.
 */
export async function requirePermission(kode: KodeHakAkses, aksi: Aksi): Promise<Konteks> {
  const ktx = await konteks();
  if (!punyaIzin(ktx.izin, kode, aksi)) {
    throw new GalatAkses(403, `Akses ditolak: butuh hak ${kode}.${aksi}`);
  }
  return ktx;
}

/** Beranda sesuai peran (Req 1.2). */
export function berandaUntuk(sesi: Sesi): string {
  return sesi.peran.includes('OWNER') ? '/admin' : '/kasir';
}

const FIELD_RAHASIA = [
  'hpp_satuan',
  'total_hpp',
  'laba_kotor',
  'harga_beli_satuan',
  'harga_perolehan',
  'nilai_persediaan',
  'hpp',
] as const;

/**
 * Buang field harga beli / HPP / laba dari objek untuk pengguna tanpa LAPORAN_LABA (Req 2.5).
 * Dipakai di boundary respons API — bukan hanya menyembunyikan di UI.
 */
export function sanitasiRahasia<T>(data: T, izin: PetaIzin): T {
  if (punyaIzin(izin, 'LAPORAN_LABA', 'lihat')) return data;
  return buang(data) as T;
}

function buang(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map(buang);
  if (nilai !== null && typeof nilai === 'object' && !(nilai instanceof Date)) {
    const keluar: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
      if ((FIELD_RAHASIA as readonly string[]).includes(k)) continue;
      keluar[k] = buang(v);
    }
    return keluar;
  }
  return nilai;
}
