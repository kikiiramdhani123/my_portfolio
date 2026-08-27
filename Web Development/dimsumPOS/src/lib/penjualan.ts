import type { Klien } from './db';
import {
  d, kali, bagi, tambah, kurang, jumlahkan, maks, keUang, keKuantitas, type Desimal,
} from './money';
import { catatPergerakan, posisiStok } from './stok';
import { bahanResepAktif, type BahanResep } from './resep';
import { GalatAplikasi } from './galat';

/** Mesin penjualan — Requirement 6.5–6.14 · Design §3.2 & §3.4 */

interface InputBarisKeranjang {
  idBarang: number | string;
  idSatuan: number | string;
  jumlah: string;
  diskonBaris?: string;
}

interface InputPenjualan {
  detail: readonly InputBarisKeranjang[];
  metodePembayaran: 'TUNAI' | 'QRIS' | 'TRANSFER';
  jumlahBayar: string;
  diskon?: string;
  pajak?: string;
  catatan?: string | null;
  idempotencyKey?: string | null;
}

interface HasilPenjualan {
  idPenjualan: string;
  nomorTransaksi: string;
  total: string;
  kembalian: string;
  /** true bila transaksi dikembalikan dari idempotency, bukan dibuat baru. */
  diulang: boolean;
}

interface BarisHargaJual {
  konversi_ke_satuan_dasar: string;
  harga_jual: string;
  nama_barang: string;
  dapat_dijual: boolean;
  status_aktif: boolean;
}

/**
 * Nomor transaksi harian `INV-YYYYMMDD-NNNN` (Req 6.8 · Design §3.4).
 * Advisory lock transaksional mencegah dua kasir mendapat nomor kembar.
 */
async function buatNomorTransaksi(klien: Klien): Promise<string> {
  await klien.query("SELECT pg_advisory_xact_lock(hashtext('nomor_transaksi'))");

  const baris = await klien.satu<{ tanggal: string; urutan: string }>(
    `SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') AS tanggal,
            COALESCE(MAX(NULLIF(regexp_replace(nomor_transaksi, '^.*-', ''), '')::int), 0) + 1 AS urutan
       FROM penjualan
      WHERE nomor_transaksi LIKE 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYYMMDD') || '-%'`,
  );

  return `INV-${baris!.tanggal}-${String(baris!.urutan).padStart(4, '0')}`;
}

/**
 * Selesaikan satu transaksi penjualan secara atomik.
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function selesaikanPenjualan(
  klien: Klien,
  input: InputPenjualan,
  idPengguna: string,
): Promise<HasilPenjualan> {
  if (input.detail.length === 0) {
    throw new GalatAplikasi(422, 'Keranjang masih kosong.');
  }

  // Req 6.14 — pengiriman ulang mengembalikan transaksi yang sama, bukan duplikat.
  if (input.idempotencyKey) {
    const lama = await klien.satu<{ id_penjualan: string; nomor_transaksi: string; total_penjualan: string; jumlah_kembalian: string }>(
      `SELECT id_penjualan::text, nomor_transaksi, total_penjualan::text, jumlah_kembalian::text
         FROM penjualan WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (lama) {
      return {
        idPenjualan: lama.id_penjualan,
        nomorTransaksi: lama.nomor_transaksi,
        total: lama.total_penjualan,
        kembalian: lama.jumlah_kembalian,
        diulang: true,
      };
    }
  }

  // Kunci barang terurut menaik untuk mencegah deadlock antar-kasir (Design §3.2 langkah 2).
  const idBarangTerurut = [...new Set(input.detail.map((x) => String(x.idBarang)))].sort(
    (a, b) => Number(a) - Number(b),
  );
  await klien.query(
    'SELECT id_barang FROM barang WHERE id_barang = ANY($1::bigint[]) ORDER BY id_barang FOR UPDATE',
    [idBarangTerurut],
  );

  interface BarisSiap {
    input: InputBarisKeranjang;
    jumlah: Desimal;
    konversi: Desimal;
    jumlahDasar: Desimal;
    hargaJual: Desimal;
    diskonBaris: Desimal;
    subtotal: Desimal;
    hppSatuan: Desimal;
    totalHpp: Desimal;
    laba: Desimal;
    pemakaian: { bahan: BahanResep | null; idBarang: string; idSatuan: string; qty: Desimal; jenis: 'PENJUALAN' | 'PEMAKAIAN_RESEP' }[];
  }

  const barisSiap: BarisSiap[] = [];

  for (const baris of input.detail) {
    const jumlah = d(baris.jumlah);
    if (jumlah <= 0n) throw new GalatAplikasi(422, 'Jumlah setiap baris harus lebih besar dari 0.');

    const info = await klien.satu<BarisHargaJual>(
      `SELECT sb.konversi_ke_satuan_dasar::text, sb.harga_jual::text,
              b.nama_barang, b.dapat_dijual, b.status_aktif
         FROM satuan_barang sb
         JOIN barang b ON b.id_barang = sb.id_barang
        WHERE sb.id_barang = $1 AND sb.id_satuan = $2`,
      [baris.idBarang, baris.idSatuan],
    );
    if (!info) throw new GalatAplikasi(422, 'Satuan jual tidak terdaftar untuk barang tersebut.');
    if (!info.dapat_dijual || !info.status_aktif) {
      throw new GalatAplikasi(422, `${info.nama_barang} tidak tersedia untuk dijual.`);
    }

    const konversi = d(info.konversi_ke_satuan_dasar);
    const jumlahDasar = kali(jumlah, konversi);
    const hargaJual = d(info.harga_jual);
    const diskonBaris = d(baris.diskonBaris ?? '0');
    // Req 6.4 — subtotal tidak boleh negatif walau diskon melebihi harga.
    const subtotal = maks(kurang(kali(jumlah, hargaJual), diskonBaris), 0n);

    // Resolusi bahan (Req 5.5 / 5.6)
    const bahan = await bahanResepAktif(klien, baris.idBarang);
    const pemakaian: BarisSiap['pemakaian'] = bahan.length > 0
      ? bahan.map((b) => ({
          bahan: b,
          idBarang: b.idBarang,
          idSatuan: b.idSatuan,
          qty: kali(b.jumlahPerUnit, jumlahDasar),
          jenis: 'PEMAKAIAN_RESEP' as const,
        }))
      : [{
          bahan: null,
          idBarang: String(baris.idBarang),
          idSatuan: String(baris.idSatuan),
          qty: jumlahDasar,
          jenis: 'PENJUALAN' as const,
        }];

    // Req 5.7 — HPP produk = Σ (HPP bahan × qty bahan)
    let totalHpp = 0n;
    for (const pakai of pemakaian) {
      const posisi = await posisiStok(klien, pakai.idBarang);
      totalHpp = tambah(totalHpp, kali(posisi.hpp, pakai.qty));
    }
    const hppSatuan = bagi(totalHpp, jumlah);
    const laba = kurang(subtotal, totalHpp);

    barisSiap.push({
      input: baris, jumlah, konversi, jumlahDasar, hargaJual, diskonBaris,
      subtotal, hppSatuan, totalHpp, laba, pemakaian,
    });
  }

  const subtotal = jumlahkan(barisSiap.map((x) => x.subtotal));
  const diskon = d(input.diskon ?? '0');
  const pajak = d(input.pajak ?? '0');
  const total = maks(tambah(kurang(subtotal, diskon), pajak), 0n);
  const bayar = d(input.jumlahBayar);

  // Req 6.6
  if (input.metodePembayaran === 'TUNAI' && bayar < total) {
    throw new GalatAplikasi(422, 'Jumlah bayar kurang dari total belanja.');
  }
  const bayarEfektif = input.metodePembayaran === 'TUNAI' ? bayar : total;
  const kembalian = maks(kurang(bayarEfektif, total), 0n);

  const nomorTransaksi = await buatNomorTransaksi(klien);

  const header = await klien.satu<{ id_penjualan: string }>(
    `INSERT INTO penjualan (nomor_transaksi, id_pengguna, subtotal, diskon, pajak,
                            total_penjualan, jumlah_bayar, jumlah_kembalian,
                            metode_pembayaran, status_penjualan, idempotency_key, catatan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SELESAI',$10,$11)
     RETURNING id_penjualan::text`,
    [
      nomorTransaksi, idPengguna, keUang(subtotal), keUang(diskon), keUang(pajak),
      keUang(total), keUang(bayarEfektif), keUang(kembalian),
      input.metodePembayaran, input.idempotencyKey ?? null, input.catatan ?? null,
    ],
  );
  const idPenjualan = header!.id_penjualan;

  for (const baris of barisSiap) {
    await klien.query(
      `INSERT INTO detail_penjualan
         (id_penjualan, id_barang, id_satuan, jumlah, harga_jual_satuan,
          konversi_ke_satuan_dasar, jumlah_satuan_dasar, diskon_baris,
          hpp_satuan, total_hpp, subtotal_penjualan, laba_kotor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        idPenjualan, baris.input.idBarang, baris.input.idSatuan,
        keKuantitas(baris.jumlah), keUang(baris.hargaJual),
        keKuantitas(baris.konversi), keKuantitas(baris.jumlahDasar),
        keUang(baris.diskonBaris), keUang(baris.hppSatuan), keUang(baris.totalHpp),
        keUang(baris.subtotal), keUang(baris.laba),
      ],
    );

    for (const pakai of baris.pemakaian) {
      await catatPergerakan(klien, {
        idBarang: pakai.idBarang,
        jenis: pakai.jenis,
        referensiId: idPenjualan,
        jumlah: pakai.qty,
        idSatuan: pakai.idSatuan,
        konversi: d(1),          // qty sudah dalam satuan dasar
        arah: -1,
        idPengguna,
        catatan: nomorTransaksi,
      });
    }
  }

  return {
    idPenjualan,
    nomorTransaksi,
    total: keUang(total),
    kembalian: keUang(kembalian),
    diulang: false,
  };
}

/**
 * Batalkan penjualan: kembalikan stok lewat pergerakan pembalik (Req 6.13).
 * WAJIB dipanggil di dalam `withTransaction`.
 */
export async function batalkanPenjualan(
  klien: Klien,
  idPenjualan: string | number,
  idPengguna: string,
  alasan: string,
): Promise<void> {
  const header = await klien.satu<{ status_penjualan: string; nomor_transaksi: string }>(
    'SELECT status_penjualan, nomor_transaksi FROM penjualan WHERE id_penjualan = $1 FOR UPDATE',
    [idPenjualan],
  );
  if (!header) throw new GalatAplikasi(404, 'Transaksi tidak ditemukan.');
  if (header.status_penjualan === 'BATAL') {
    throw new GalatAplikasi(409, 'Transaksi ini sudah dibatalkan.');
  }

  // Kembalikan seluruh pemakaian stok transaksi ini, apa pun jenisnya.
  const pergerakan = await klien.query<{
    id_barang: string; id_satuan: string; jumlah_satuan_dasar: string;
  }>(
    `SELECT id_barang::text, id_satuan::text, jumlah_satuan_dasar::text
       FROM pergerakan_stok
      WHERE referensi_id = $1
        AND jenis_pergerakan IN ('PENJUALAN','PEMAKAIAN_RESEP')
      ORDER BY id_barang`,
    [idPenjualan],
  );

  for (const baris of pergerakan) {
    const posisi = await posisiStok(klien, baris.id_barang);
    const qty = d(baris.jumlah_satuan_dasar);
    await catatPergerakan(klien, {
      idBarang: baris.id_barang,
      jenis: 'BATAL_PENJUALAN',
      referensiId: idPenjualan,
      jumlah: qty,
      idSatuan: baris.id_satuan,
      konversi: d(1),
      // Masuk kembali pada HPP berjalan agar rata-rata tidak terdistorsi.
      nilaiMasuk: kali(posisi.hpp, qty),
      arah: 1,
      idPengguna,
      catatan: `Batal ${header.nomor_transaksi}: ${alasan}`,
    });
  }

  await klien.query(
    `UPDATE penjualan
        SET status_penjualan = 'BATAL',
            catatan = COALESCE(catatan || ' | ', '') || $2
      WHERE id_penjualan = $1`,
    [idPenjualan, `Dibatalkan: ${alasan}`],
  );
}
