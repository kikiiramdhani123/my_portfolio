import type { Klien } from './db';
import {
  d, tambah, kurang, kali, bagi, keUang, keKuantitas, type Desimal,
} from './money';

/**
 * Mesin stok — satu-satunya jalan mengubah stok (tech.md aturan 4).
 * HPP memakai Weighted Average / rata-rata bergerak (Design §3.1).
 */

export type JenisPergerakan =
  | 'PEMBELIAN'
  | 'BATAL_PEMBELIAN'
  | 'PENJUALAN'
  | 'PEMAKAIAN_RESEP'
  | 'BATAL_PENJUALAN'
  | 'PENYESUAIAN'
  | 'SALDO_AWAL';

export interface PosisiStok {
  /** Saldo dalam satuan dasar. */
  saldo: Desimal;
  /** Nilai persediaan total (Rp). */
  nilai: Desimal;
  /** HPP rata-rata per satuan dasar (Rp). */
  hpp: Desimal;
}

interface BarisPergerakanTerakhir {
  nilai_persediaan: string;
  harga_perolehan: string;
}

interface BarisSaldo {
  saldo: string | null;
}

/**
 * Posisi stok terkini satu barang.
 * Saldo dihitung dari agregat kartu stok (Req 7.2); nilai persediaan & HPP
 * diambil dari baris pergerakan terakhir (sumber kebenaran rata-rata bergerak).
 */
export async function posisiStok(klien: Klien, idBarang: number | string): Promise<PosisiStok> {
  const [agregat, terakhir] = await Promise.all([
    klien.satu<BarisSaldo>(
      `SELECT COALESCE(SUM(arah_stok * jumlah_satuan_dasar), 0)::text AS saldo
         FROM pergerakan_stok WHERE id_barang = $1`,
      [idBarang],
    ),
    klien.satu<BarisPergerakanTerakhir>(
      `SELECT nilai_persediaan, harga_perolehan
         FROM pergerakan_stok
        WHERE id_barang = $1
        ORDER BY id_pergerakan_stok DESC
        LIMIT 1`,
      [idBarang],
    ),
  ]);

  return {
    saldo: d(agregat?.saldo ?? '0'),
    nilai: d(terakhir?.nilai_persediaan ?? '0'),
    hpp: d(terakhir?.harga_perolehan ?? '0'),
  };
}

/** HPP per satuan dasar saat ini. */
export async function hppSaatIni(klien: Klien, idBarang: number | string): Promise<Desimal> {
  return (await posisiStok(klien, idBarang)).hpp;
}

export interface InputPergerakan {
  idBarang: number | string;
  jenis: JenisPergerakan;
  referensiId?: number | string | null;
  /** Jumlah pada satuan input. */
  jumlah: Desimal;
  idSatuan: number | string;
  /** Faktor konversi satuan input → satuan dasar. */
  konversi: Desimal;
  /**
   * Nilai uang barang masuk (harga beli total baris ini).
   * Wajib untuk arah +1; diabaikan untuk arah -1 (pengeluaran memakai HPP berjalan).
   */
  nilaiMasuk?: Desimal;
  arah: 1 | -1;
  idPengguna: number | string;
  catatan?: string | null;
}

export interface HasilPergerakan {
  idPergerakan: string;
  /** HPP per satuan dasar setelah pergerakan ini. */
  hpp: Desimal;
  saldoSesudah: Desimal;
  nilaiSesudah: Desimal;
}

/**
 * Catat satu baris kartu stok dan perbarui rata-rata bergerak.
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function catatPergerakan(
  klien: Klien,
  input: InputPergerakan,
): Promise<HasilPergerakan> {
  // Kunci barang agar dua transaksi tidak menghitung rata-rata dari saldo yang sama.
  await klien.query('SELECT id_barang FROM barang WHERE id_barang = $1 FOR UPDATE', [input.idBarang]);

  const sebelum = await posisiStok(klien, input.idBarang);
  const jumlahDasar = kali(input.jumlah, input.konversi);

  let hppBaru: Desimal;
  let nilaiBaru: Desimal;
  let saldoBaru: Desimal;

  if (input.arah === 1) {
    const nilaiMasuk = input.nilaiMasuk ?? kali(sebelum.hpp, jumlahDasar);
    saldoBaru = tambah(sebelum.saldo, jumlahDasar);
    nilaiBaru = tambah(sebelum.nilai, nilaiMasuk);
    hppBaru = saldoBaru > 0n ? bagi(nilaiBaru, saldoBaru) : sebelum.hpp;
  } else {
    // Pengeluaran tidak mengubah rata-rata; nilai persediaan berkurang sebesar HPP × qty.
    hppBaru = sebelum.hpp;
    saldoBaru = kurang(sebelum.saldo, jumlahDasar);
    nilaiBaru = kurang(sebelum.nilai, kali(hppBaru, jumlahDasar));
    // Saldo habis → nilai persediaan wajib nol agar sisa pembulatan tidak menumpuk.
    if (saldoBaru <= 0n) nilaiBaru = 0n;
  }

  const baris = await klien.satu<{ id_pergerakan_stok: string }>(
    `INSERT INTO pergerakan_stok
       (id_barang, jenis_pergerakan, referensi_id, jumlah, id_satuan,
        jumlah_satuan_dasar, harga_perolehan, nilai_persediaan, arah_stok, id_pengguna, catatan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id_pergerakan_stok`,
    [
      input.idBarang,
      input.jenis,
      input.referensiId ?? null,
      keKuantitas(input.jumlah),
      input.idSatuan,
      keKuantitas(jumlahDasar),
      keUang(hppBaru),
      keUang(nilaiBaru),
      input.arah,
      input.idPengguna,
      input.catatan ?? null,
    ],
  );

  return {
    idPergerakan: baris!.id_pergerakan_stok,
    hpp: hppBaru,
    saldoSesudah: saldoBaru,
    nilaiSesudah: nilaiBaru,
  };
}

export interface RingkasanStokBarang {
  id_barang: string;
  kode_barang: string;
  nama_barang: string;
  jenis_barang: string;
  kode_satuan: string;
  stok_minimum: string;
  saldo: string;
  hpp: string;
  nilai_persediaan: string;
  menipis: boolean;
}

/** Ringkasan saldo seluruh barang, lengkap dengan penanda stok menipis (Req 7.5). */
export async function ringkasanStok(klien: Klien, cari?: string): Promise<RingkasanStokBarang[]> {
  return klien.query<RingkasanStokBarang>(
    `WITH saldo AS (
       SELECT id_barang, SUM(arah_stok * jumlah_satuan_dasar) AS saldo
         FROM pergerakan_stok GROUP BY id_barang
     ), terakhir AS (
       SELECT DISTINCT ON (id_barang) id_barang, harga_perolehan, nilai_persediaan
         FROM pergerakan_stok ORDER BY id_barang, id_pergerakan_stok DESC
     )
     SELECT b.id_barang::text, b.kode_barang, b.nama_barang, b.jenis_barang,
            s.kode_satuan, b.stok_minimum::text,
            COALESCE(sa.saldo, 0)::text                AS saldo,
            COALESCE(t.harga_perolehan, 0)::text       AS hpp,
            COALESCE(t.nilai_persediaan, 0)::text      AS nilai_persediaan,
            COALESCE(sa.saldo, 0) <= b.stok_minimum    AS menipis
       FROM barang b
       JOIN satuan s     ON s.id_satuan = b.id_satuan_dasar
       LEFT JOIN saldo sa ON sa.id_barang = b.id_barang
       LEFT JOIN terakhir t ON t.id_barang = b.id_barang
      WHERE b.status_aktif
        AND ($1::text IS NULL OR b.nama_barang ILIKE '%'||$1||'%' OR b.kode_barang ILIKE '%'||$1||'%')
      ORDER BY (COALESCE(sa.saldo,0) <= b.stok_minimum) DESC, b.nama_barang`,
    [cari ?? null],
  );
}

export interface BarisKartuStok {
  id_pergerakan_stok: string;
  tanggal_pergerakan: string;
  jenis_pergerakan: string;
  referensi_id: string | null;
  jumlah_satuan_dasar: string;
  arah_stok: number;
  harga_perolehan: string;
  nilai_persediaan: string;
  catatan: string | null;
  nama_pengguna: string;
  saldo_berjalan: string;
}

/** Kartu stok satu barang dengan saldo berjalan per baris (Req 7.6). */
export async function kartuStok(
  klien: Klien,
  idBarang: number | string,
  batas = 300,
): Promise<BarisKartuStok[]> {
  return klien.query<BarisKartuStok>(
    `SELECT p.id_pergerakan_stok::text, p.tanggal_pergerakan, p.jenis_pergerakan,
            p.referensi_id::text, p.jumlah_satuan_dasar::text, p.arah_stok,
            p.harga_perolehan::text, p.nilai_persediaan::text, p.catatan,
            u.nama_pengguna,
            SUM(p.arah_stok * p.jumlah_satuan_dasar)
              OVER (ORDER BY p.id_pergerakan_stok)::text AS saldo_berjalan
       FROM pergerakan_stok p
       JOIN pengguna u ON u.id_pengguna = p.id_pengguna
      WHERE p.id_barang = $1
      ORDER BY p.id_pergerakan_stok DESC
      LIMIT $2`,
    [idBarang, batas],
  );
}
