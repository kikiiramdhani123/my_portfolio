import type { Klien } from './db';
import { d, kali, type Desimal } from './money';
import { GalatAplikasi } from './galat';

/** Resep / BOM — Requirement 5.1–5.7 · Design §3.3 */

export interface BahanResep {
  idBarang: string;
  namaBarang: string;
  idSatuan: string;
  /** Jumlah bahan (satuan dasar bahan) per 1 satuan dasar produk hasil. */
  jumlahPerUnit: Desimal;
}

interface BarisBahan {
  id_barang_bahan: string;
  nama_barang: string;
  id_satuan_dasar: string;
  jumlah: string;
  konversi: string;
}

/**
 * Bahan resep aktif sebuah produk, jumlah sudah dinormalkan ke satuan dasar bahan.
 * Mengembalikan array kosong bila produk tidak punya resep aktif (Req 5.6).
 */
export async function bahanResepAktif(klien: Klien, idBarangHasil: string | number): Promise<BahanResep[]> {
  const baris = await klien.query<BarisBahan>(
    `SELECT dr.id_barang_bahan::text,
            b.nama_barang,
            b.id_satuan_dasar::text AS id_satuan_dasar,
            dr.jumlah::text,
            COALESCE(sb.konversi_ke_satuan_dasar, 1)::text AS konversi
       FROM resep r
       JOIN detail_resep dr ON dr.id_resep = r.id_resep
       JOIN barang b        ON b.id_barang = dr.id_barang_bahan
       LEFT JOIN satuan_barang sb
              ON sb.id_barang = dr.id_barang_bahan AND sb.id_satuan = dr.id_satuan
      WHERE r.id_barang_hasil = $1 AND r.status_aktif
      ORDER BY dr.id_detail_resep`,
    [idBarangHasil],
  );

  return baris.map((b) => ({
    idBarang: b.id_barang_bahan,
    namaBarang: b.nama_barang,
    idSatuan: b.id_satuan_dasar,
    jumlahPerUnit: kali(d(b.jumlah), d(b.konversi)),
  }));
}

/**
 * Deteksi siklus resep (Req 5.4): apakah `idBarangHasil` muncul kembali
 * saat menelusuri bahan-bahan `kandidatBahan` secara rekursif.
 */
export async function deteksiSiklus(
  klien: Klien,
  idBarangHasil: string,
  kandidatBahan: readonly string[],
  kedalamanMaks = 10,
): Promise<string | null> {
  if (kandidatBahan.includes(String(idBarangHasil))) {
    return 'Resep tidak boleh memuat produk hasilnya sendiri sebagai bahan.';
  }

  const dikunjungi = new Set<string>([String(idBarangHasil)]);
  let lapisan = [...kandidatBahan.map(String)];

  for (let kedalaman = 0; kedalaman < kedalamanMaks && lapisan.length > 0; kedalaman += 1) {
    const berikut = await klien.query<{ id_barang_bahan: string }>(
      `SELECT DISTINCT dr.id_barang_bahan::text
         FROM resep r
         JOIN detail_resep dr ON dr.id_resep = r.id_resep
        WHERE r.status_aktif AND r.id_barang_hasil = ANY($1::bigint[])`,
      [lapisan],
    );

    const baru: string[] = [];
    for (const { id_barang_bahan: id } of berikut) {
      if (id === String(idBarangHasil)) {
        return 'Resep membentuk lingkaran: bahan ini pada akhirnya memakai produk hasil itu sendiri.';
      }
      if (!dikunjungi.has(id)) {
        dikunjungi.add(id);
        baru.push(id);
      }
    }
    lapisan = baru;
  }
  return null;
}

export interface InputDetailResep {
  idBarangBahan: number | string;
  idSatuan: number | string;
  jumlah: string;
  catatan?: string | null;
}

export interface InputResep {
  idBarangHasil: number | string;
  namaResep: string;
  tanggalBerlaku?: string | null;
  detail: readonly InputDetailResep[];
}

/**
 * Simpan resep sebagai versi baru dan aktifkan; versi sebelumnya dinonaktifkan (Req 5.3).
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function simpanResep(klien: Klien, input: InputResep): Promise<string> {
  if (input.detail.length === 0) {
    throw new GalatAplikasi(422, 'Resep harus memiliki minimal satu bahan.');
  }

  const galatSiklus = await deteksiSiklus(
    klien,
    String(input.idBarangHasil),
    input.detail.map((x) => String(x.idBarangBahan)),
  );
  if (galatSiklus) throw new GalatAplikasi(422, galatSiklus);

  // Req 5.3 — nonaktifkan versi lama sebelum menyisipkan yang baru
  // (unique partial index hanya mengizinkan satu resep aktif per barang).
  await klien.query(
    'UPDATE resep SET status_aktif = FALSE WHERE id_barang_hasil = $1 AND status_aktif',
    [input.idBarangHasil],
  );

  const versi = await klien.satu<{ versi: string }>(
    'SELECT COALESCE(MAX(versi_resep), 0) + 1 AS versi FROM resep WHERE id_barang_hasil = $1',
    [input.idBarangHasil],
  );

  const header = await klien.satu<{ id_resep: string }>(
    `INSERT INTO resep (id_barang_hasil, nama_resep, versi_resep, tanggal_berlaku, status_aktif)
     VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE), TRUE)
     RETURNING id_resep::text`,
    [input.idBarangHasil, input.namaResep, Number(versi?.versi ?? 1), input.tanggalBerlaku ?? null],
  );
  const idResep = header!.id_resep;

  for (const baris of input.detail) {
    await klien.query(
      `INSERT INTO detail_resep (id_resep, id_barang_bahan, id_satuan, jumlah, catatan)
       VALUES ($1,$2,$3,$4,$5)`,
      [idResep, baris.idBarangBahan, baris.idSatuan, baris.jumlah, baris.catatan ?? null],
    );
  }

  return idResep;
}
