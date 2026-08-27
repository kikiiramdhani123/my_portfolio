import { query } from './db';

/** Laporan & dasbor — Requirement 9.1–9.6 */

interface Rentang {
  dari: string;
  sampai: string;
}

/** Rentang default: hari ini (WIB). */
function rentangHariIni(): Rentang {
  const kini = new Date();
  const wib = new Date(kini.getTime() + 7 * 3_600_000);
  const tanggal = wib.toISOString().slice(0, 10);
  return { dari: tanggal, sampai: tanggal };
}

export function normalkanRentang(dari?: string | null, sampai?: string | null): Rentang {
  const bawaan = rentangHariIni();
  return { dari: dari || bawaan.dari, sampai: sampai || bawaan.sampai };
}

/** Klausa WHERE tanggal yang konsisten dipakai seluruh laporan (batas WIB, inklusif). */
const FILTER_TANGGAL = `
  tanggal_penjualan >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
  AND tanggal_penjualan < (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
`;

interface Ringkasan {
  omzet: string;
  jumlah_transaksi: string;
  total_hpp: string;
  laba_kotor: string;
  total_biaya: string;
  laba_bersih: string;
  item_terjual: string;
}

/** KPI dasbor pemilik (Req 9.1, 9.3, 8.4). */
export async function ringkasan(r: Rentang): Promise<Ringkasan> {
  const baris = await query<Ringkasan>(
    `WITH pj AS (
       SELECT p.id_penjualan, p.total_penjualan
         FROM penjualan p
        WHERE p.status_penjualan = 'SELESAI' AND ${FILTER_TANGGAL}
     ), dt AS (
       SELECT COALESCE(SUM(d.total_hpp), 0)   AS total_hpp,
              COALESCE(SUM(d.laba_kotor), 0)  AS laba_kotor,
              COALESCE(SUM(d.jumlah), 0)      AS item_terjual
         FROM detail_penjualan d
         JOIN pj ON pj.id_penjualan = d.id_penjualan
     ), by AS (
       SELECT COALESCE(SUM(jumlah), 0) AS total_biaya
         FROM biaya_operasional
        WHERE tanggal_biaya >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
          AND tanggal_biaya <  (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
     )
     SELECT COALESCE((SELECT SUM(total_penjualan) FROM pj), 0)::text AS omzet,
            (SELECT COUNT(*) FROM pj)::text                          AS jumlah_transaksi,
            dt.total_hpp::text,
            dt.laba_kotor::text,
            by.total_biaya::text,
            (dt.laba_kotor - by.total_biaya)::text                    AS laba_bersih,
            dt.item_terjual::text
       FROM dt, by`,
    [r.dari, r.sampai],
  );
  return baris[0]!;
}

interface TitikHarian {
  tanggal: string;
  omzet: string;
  laba_kotor: string;
  transaksi: string;
}

/** Deret harian untuk grafik dasbor. */
export async function penjualanHarian(r: Rentang): Promise<TitikHarian[]> {
  return query<TitikHarian>(
    `WITH hari AS (
       SELECT generate_series($1::date, $2::date, '1 day')::date AS tanggal
     )
     SELECT to_char(h.tanggal, 'YYYY-MM-DD') AS tanggal,
            COALESCE(SUM(p.total_penjualan), 0)::text AS omzet,
            COALESCE(SUM(dl.laba), 0)::text           AS laba_kotor,
            COUNT(DISTINCT p.id_penjualan)::text      AS transaksi
       FROM hari h
       LEFT JOIN penjualan p
              ON p.status_penjualan = 'SELESAI'
             AND (p.tanggal_penjualan AT TIME ZONE 'Asia/Jakarta')::date = h.tanggal
       LEFT JOIN LATERAL (
              SELECT SUM(d.laba_kotor) AS laba FROM detail_penjualan d
               WHERE d.id_penjualan = p.id_penjualan
            ) dl ON TRUE
      GROUP BY h.tanggal
      ORDER BY h.tanggal`,
    [r.dari, r.sampai],
  );
}

interface BarisPenjualan {
  id_penjualan: string;
  nomor_transaksi: string;
  tanggal_penjualan: string;
  nama_pengguna: string;
  metode_pembayaran: string;
  status_penjualan: string;
  total_penjualan: string;
  laba_kotor: string;
  jumlah_item: string;
}

export async function laporanPenjualan(r: Rentang, batas = 500): Promise<BarisPenjualan[]> {
  return query<BarisPenjualan>(
    `SELECT p.id_penjualan::text, p.nomor_transaksi, p.tanggal_penjualan,
            u.nama_pengguna, p.metode_pembayaran, p.status_penjualan,
            p.total_penjualan::text,
            COALESCE(SUM(d.laba_kotor), 0)::text AS laba_kotor,
            COALESCE(SUM(d.jumlah), 0)::text     AS jumlah_item
       FROM penjualan p
       JOIN pengguna u ON u.id_pengguna = p.id_pengguna
       LEFT JOIN detail_penjualan d ON d.id_penjualan = p.id_penjualan
      WHERE ${FILTER_TANGGAL}
      GROUP BY p.id_penjualan, u.nama_pengguna
      ORDER BY p.tanggal_penjualan DESC
      LIMIT $3`,
    [r.dari, r.sampai, batas],
  );
}

interface BarisTerlaris {
  id_barang: string;
  kode_barang: string;
  nama_barang: string;
  qty: string;
  omzet: string;
  laba_kotor: string;
}

export async function produkTerlaris(r: Rentang, batas = 20): Promise<BarisTerlaris[]> {
  return query<BarisTerlaris>(
    `SELECT b.id_barang::text, b.kode_barang, b.nama_barang,
            SUM(d.jumlah)::text             AS qty,
            SUM(d.subtotal_penjualan)::text AS omzet,
            SUM(d.laba_kotor)::text         AS laba_kotor
       FROM detail_penjualan d
       JOIN penjualan p ON p.id_penjualan = d.id_penjualan
       JOIN barang b    ON b.id_barang = d.id_barang
      WHERE p.status_penjualan = 'SELESAI' AND ${FILTER_TANGGAL}
      GROUP BY b.id_barang
      ORDER BY SUM(d.jumlah) DESC
      LIMIT $3`,
    [r.dari, r.sampai, batas],
  );
}

interface BarisLabaRugi {
  keterangan: string;
  nilai: string;
  jenis: 'PENDAPATAN' | 'HPP' | 'BIAYA' | 'TOTAL';
}

/** Laporan laba rugi sederhana: omzet − HPP = laba kotor; − biaya = laba bersih (Req 8.4). */
export async function labaRugi(r: Rentang): Promise<BarisLabaRugi[]> {
  const total = await ringkasan(r);
  const biaya = await query<{ kategori_biaya: string; jumlah: string }>(
    `SELECT kategori_biaya, SUM(jumlah)::text AS jumlah
       FROM biaya_operasional
      WHERE tanggal_biaya >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
        AND tanggal_biaya <  (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
      GROUP BY kategori_biaya ORDER BY SUM(jumlah) DESC`,
    [r.dari, r.sampai],
  );

  return [
    { keterangan: 'Penjualan (Omzet)', nilai: total.omzet, jenis: 'PENDAPATAN' },
    { keterangan: 'Harga Pokok Penjualan (HPP)', nilai: `-${total.total_hpp}`, jenis: 'HPP' },
    { keterangan: 'LABA KOTOR', nilai: total.laba_kotor, jenis: 'TOTAL' },
    ...biaya.map((b): BarisLabaRugi => ({
      keterangan: `Biaya ${b.kategori_biaya}`, nilai: `-${b.jumlah}`, jenis: 'BIAYA',
    })),
    { keterangan: 'LABA BERSIH', nilai: total.laba_bersih, jenis: 'TOTAL' },
  ];
}

interface BarisPembelianLaporan {
  id_pembelian: string;
  nomor_faktur_pembelian: string;
  tanggal_pembelian: string;
  nama_pemasok: string | null;
  status_pembelian: string;
  total_pembelian: string;
}

export async function laporanPembelian(r: Rentang): Promise<BarisPembelianLaporan[]> {
  return query<BarisPembelianLaporan>(
    `SELECT pb.id_pembelian::text, pb.nomor_faktur_pembelian, pb.tanggal_pembelian,
            pm.nama_pemasok, pb.status_pembelian, pb.total_pembelian::text
       FROM pembelian pb
       LEFT JOIN pemasok pm ON pm.id_pemasok = pb.id_pemasok
      WHERE pb.tanggal_pembelian >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
        AND pb.tanggal_pembelian <  (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
      ORDER BY pb.tanggal_pembelian DESC`,
    [r.dari, r.sampai],
  );
}

interface BarisBiayaLaporan {
  id_biaya: string;
  tanggal_biaya: string;
  kategori_biaya: string;
  keterangan: string | null;
  jumlah: string;
  nama_pengguna: string;
}

export async function laporanBiaya(r: Rentang): Promise<BarisBiayaLaporan[]> {
  return query<BarisBiayaLaporan>(
    `SELECT b.id_biaya::text, b.tanggal_biaya, b.kategori_biaya, b.keterangan,
            b.jumlah::text, u.nama_pengguna
       FROM biaya_operasional b
       JOIN pengguna u ON u.id_pengguna = b.id_pengguna
      WHERE b.tanggal_biaya >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
        AND b.tanggal_biaya <  (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
      ORDER BY b.tanggal_biaya DESC`,
    [r.dari, r.sampai],
  );
}

/** Ubah array objek menjadi CSV (Req 9.4). */
export function keCsv(baris: readonly Record<string, unknown>[]): string {
  if (baris.length === 0) return '';
  const kolom = Object.keys(baris[0]!);
  const kutip = (v: unknown): string => {
    const teks = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
  };
  return [
    kolom.join(';'),
    ...baris.map((b) => kolom.map((k) => kutip(b[k])).join(';')),
  ].join('\n');
}
