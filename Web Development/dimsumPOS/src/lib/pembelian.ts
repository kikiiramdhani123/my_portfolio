import type { Klien } from './db';
import { d, kali, tambah, kurang, jumlahkan, keUang, keKuantitas, type Desimal } from './money';
import { catatPergerakan } from './stok';
import { GalatAplikasi } from './galat';

/** Pembelian / barang masuk — Requirement 4.1–4.9 */

export interface InputDetailPembelian {
  idBarang: number | string;
  idSatuan: number | string;
  jumlah: string;
  hargaBeliSatuan: string;
}

export interface InputPembelian {
  nomorFaktur: string;
  tanggal?: string | null;
  idPemasok?: number | string | null;
  diskon?: string;
  pajak?: string;
  status: 'DRAFT' | 'SELESAI';
  catatan?: string | null;
  detail: readonly InputDetailPembelian[];
}

interface BarisSatuanBarang {
  konversi_ke_satuan_dasar: string;
  nama_barang: string;
}

export interface HasilPembelian {
  idPembelian: string;
  nomorFaktur: string;
  total: string;
}

/**
 * Simpan pembelian secara atomik: header + detail + (bila SELESAI) tambah stok & kartu stok.
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function simpanPembelian(
  klien: Klien,
  input: InputPembelian,
  idPengguna: string,
): Promise<HasilPembelian> {
  if (input.detail.length === 0) {
    throw new GalatAplikasi(422, 'Pembelian harus memiliki minimal satu baris barang.');
  }

  // Req 4.4 — seluruh angka dihitung ulang di server; kiriman klien diabaikan.
  const dihitung = await Promise.all(
    input.detail.map(async (baris) => {
      const jumlah = d(baris.jumlah);
      const harga = d(baris.hargaBeliSatuan);
      // Req 4.6
      if (jumlah <= 0n) throw new GalatAplikasi(422, 'Jumlah setiap baris harus lebih besar dari 0.');
      if (harga < 0n) throw new GalatAplikasi(422, 'Harga beli tidak boleh negatif.');

      const satuan = await klien.satu<BarisSatuanBarang>(
        `SELECT sb.konversi_ke_satuan_dasar::text, b.nama_barang
           FROM satuan_barang sb
           JOIN barang b ON b.id_barang = sb.id_barang
          WHERE sb.id_barang = $1 AND sb.id_satuan = $2`,
        [baris.idBarang, baris.idSatuan],
      );
      if (!satuan) {
        throw new GalatAplikasi(422, 'Satuan yang dipilih belum terdaftar untuk barang tersebut.');
      }

      const konversi = d(satuan.konversi_ke_satuan_dasar);
      return {
        ...baris,
        jumlah,
        harga,
        konversi,
        jumlahDasar: kali(jumlah, konversi),   // Req 4.3
        subtotal: kali(jumlah, harga),
      };
    }),
  );

  const subtotal = jumlahkan(dihitung.map((x) => x.subtotal));
  const diskon = d(input.diskon ?? '0');
  const pajak = d(input.pajak ?? '0');
  const total = tambah(kurang(subtotal, diskon), pajak);

  const header = await klien.satu<{ id_pembelian: string }>(
    `INSERT INTO pembelian (nomor_faktur_pembelian, tanggal_pembelian, id_pemasok,
                            subtotal, diskon, pajak, total_pembelian,
                            status_pembelian, catatan, id_pengguna)
     VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_pembelian::text`,
    [
      input.nomorFaktur, input.tanggal ?? null, input.idPemasok ?? null,
      keUang(subtotal), keUang(diskon), keUang(pajak), keUang(total),
      input.status, input.catatan ?? null, idPengguna,
    ],
  );
  const idPembelian = header!.id_pembelian;

  for (const baris of dihitung) {
    await klien.query(
      `INSERT INTO detail_pembelian (id_pembelian, id_barang, id_satuan, jumlah,
                                     harga_beli_satuan, konversi_ke_satuan_dasar,
                                     jumlah_satuan_dasar, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        idPembelian, baris.idBarang, baris.idSatuan, keKuantitas(baris.jumlah),
        keUang(baris.harga), keKuantitas(baris.konversi),
        keKuantitas(baris.jumlahDasar), keUang(baris.subtotal),
      ],
    );

    // Req 4.7 — DRAFT tidak mengubah stok.
    if (input.status !== 'SELESAI') continue;

    // Req 4.2 & 4.5 — stok naik dan HPP rata-rata bergerak diperbarui.
    await catatPergerakan(klien, {
      idBarang: baris.idBarang,
      jenis: 'PEMBELIAN',
      referensiId: idPembelian,
      jumlah: baris.jumlah,
      idSatuan: baris.idSatuan,
      konversi: baris.konversi,
      nilaiMasuk: baris.subtotal,
      arah: 1,
      idPengguna,
      catatan: `Faktur ${input.nomorFaktur}`,
    });
  }

  return { idPembelian, nomorFaktur: input.nomorFaktur, total: keUang(total) };
}

interface BarisDetailTersimpan {
  id_barang: string;
  id_satuan: string;
  jumlah: string;
  konversi_ke_satuan_dasar: string;
  subtotal: string;
}

/**
 * Batalkan pembelian SELESAI: buat pergerakan pembalik, jangan hapus riwayat (Req 4.8).
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function batalkanPembelian(
  klien: Klien,
  idPembelian: string | number,
  idPengguna: string,
  alasan: string,
): Promise<void> {
  const header = await klien.satu<{ status_pembelian: string; nomor_faktur_pembelian: string }>(
    'SELECT status_pembelian, nomor_faktur_pembelian FROM pembelian WHERE id_pembelian = $1 FOR UPDATE',
    [idPembelian],
  );
  if (!header) throw new GalatAplikasi(404, 'Pembelian tidak ditemukan.');
  if (header.status_pembelian === 'BATAL') {
    throw new GalatAplikasi(409, 'Pembelian ini sudah dibatalkan.');
  }

  if (header.status_pembelian === 'SELESAI') {
    const detail = await klien.query<BarisDetailTersimpan>(
      `SELECT id_barang::text, id_satuan::text, jumlah::text,
              konversi_ke_satuan_dasar::text, subtotal::text
         FROM detail_pembelian WHERE id_pembelian = $1 ORDER BY id_barang`,
      [idPembelian],
    );
    for (const baris of detail) {
      await catatPergerakan(klien, {
        idBarang: baris.id_barang,
        jenis: 'BATAL_PEMBELIAN',
        referensiId: idPembelian,
        jumlah: d(baris.jumlah),
        idSatuan: baris.id_satuan,
        konversi: d(baris.konversi_ke_satuan_dasar),
        arah: -1,
        idPengguna,
        catatan: `Batal faktur ${header.nomor_faktur_pembelian}: ${alasan}`,
      });
    }
  }

  await klien.query(
    `UPDATE pembelian
        SET status_pembelian = 'BATAL',
            catatan = COALESCE(catatan || ' | ', '') || $2
      WHERE id_pembelian = $1`,
    [idPembelian, `Dibatalkan: ${alasan}`],
  );
}

/** Total nilai pembelian pada rentang tanggal — dipakai laporan. */
export function totalPembelian(nilai: readonly Desimal[]): Desimal {
  return jumlahkan(nilai);
}
