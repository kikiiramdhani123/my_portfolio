import { z } from 'zod';

/** Skema validasi setiap boundary API — pesan berbahasa Indonesia (Design §7). */

/** Angka desimal dikirim sebagai string agar presisi tidak hilang di JSON. */
const desimal = (pesan = 'Harus berupa angka') =>
  z.union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^-?\d*(\.\d+)?$/.test(v) && v !== '' && v !== '-', { message: pesan });

const idDb = z.union([z.string(), z.number()]).transform((v) => String(v))
  .refine((v) => /^\d+$/.test(v), { message: 'ID tidak valid' });

export const skemaLogin = z.object({
  username: z.string().min(1, 'Username wajib diisi').max(80),
  kataSandi: z.string().min(1, 'Kata sandi wajib diisi').max(200),
});

export const skemaSatuan = z.object({
  kodeSatuan: z.string().min(1, 'Kode satuan wajib diisi').max(20),
  namaSatuan: z.string().min(1, 'Nama satuan wajib diisi').max(50),
});

export const skemaBarang = z.object({
  kodeBarang: z.string().min(1, 'Kode barang wajib diisi').max(50),
  namaBarang: z.string().min(1, 'Nama barang wajib diisi').max(150),
  jenisBarang: z.enum(['MAKANAN', 'MINUMAN', 'BAHAN', 'KEMASAN', 'LAINNYA']),
  idSatuanDasar: idDb,
  dapatDijual: z.boolean().default(false),
  dapatDibeli: z.boolean().default(true),
  statusAktif: z.boolean().default(true),
  stokMinimum: desimal('Stok minimum harus angka').default('0'),
  hargaJual: desimal('Harga jual harus angka').default('0'),
  emoji: z.string().max(8).nullish(),
  warnaKartu: z.string().max(20).nullish(),
});

export const skemaSatuanBarang = z.object({
  idSatuan: idDb,
  konversiKeSatuanDasar: desimal('Konversi harus angka')
    .refine((v) => Number(v) > 0, { message: 'Konversi harus lebih besar dari 0' }),
  hargaJual: desimal('Harga jual harus angka').default('0'),
  barcode: z.string().max(100).nullish(),
});

export const skemaPemasok = z.object({
  kodePemasok: z.string().min(1, 'Kode pemasok wajib diisi').max(50),
  namaPemasok: z.string().min(1, 'Nama pemasok wajib diisi').max(150),
  nomorTelepon: z.string().max(30).nullish(),
  alamat: z.string().max(500).nullish(),
  statusAktif: z.boolean().default(true),
});

export const skemaPembelian = z.object({
  nomorFaktur: z.string().min(1, 'Nomor faktur wajib diisi').max(80),
  tanggal: z.string().nullish(),
  idPemasok: idDb.nullish(),
  diskon: desimal().default('0'),
  pajak: desimal().default('0'),
  status: z.enum(['DRAFT', 'SELESAI']).default('SELESAI'),
  catatan: z.string().max(1000).nullish(),
  detail: z.array(z.object({
    idBarang: idDb,
    idSatuan: idDb,
    jumlah: desimal('Jumlah harus angka'),
    hargaBeliSatuan: desimal('Harga beli harus angka'),
  })).min(1, 'Minimal satu baris barang'),
});

export const skemaResep = z.object({
  idBarangHasil: idDb,
  namaResep: z.string().min(1, 'Nama resep wajib diisi').max(150),
  tanggalBerlaku: z.string().nullish(),
  detail: z.array(z.object({
    idBarangBahan: idDb,
    idSatuan: idDb,
    jumlah: desimal('Jumlah bahan harus angka'),
    catatan: z.string().max(255).nullish(),
  })).min(1, 'Minimal satu bahan'),
});

export const skemaPenjualan = z.object({
  detail: z.array(z.object({
    idBarang: idDb,
    idSatuan: idDb,
    jumlah: desimal('Jumlah harus angka'),
    diskonBaris: desimal().default('0'),
  })).min(1, 'Keranjang masih kosong'),
  metodePembayaran: z.enum(['TUNAI', 'QRIS', 'TRANSFER']),
  jumlahBayar: desimal('Jumlah bayar harus angka'),
  diskon: desimal().default('0'),
  pajak: desimal().default('0'),
  catatan: z.string().max(500).nullish(),
  idempotencyKey: z.string().max(120).nullish(),
});

export const skemaBatal = z.object({
  alasan: z.string().min(3, 'Alasan pembatalan wajib diisi (minimal 3 karakter)').max(255),
});

export const skemaOpname = z.object({
  idBarang: idDb,
  stokFisik: desimal('Stok fisik harus angka'),
  catatan: z.string().min(3, 'Catatan wajib diisi').max(255),
});

export const skemaBiaya = z.object({
  tanggalBiaya: z.string().nullish(),
  kategoriBiaya: z.string().min(1, 'Kategori wajib diisi').max(80),
  keterangan: z.string().max(500).nullish(),
  jumlah: desimal('Jumlah harus angka')
    .refine((v) => Number(v) > 0, { message: 'Jumlah harus lebih besar dari 0' }),
});

export const skemaPengguna = z.object({
  namaPengguna: z.string().min(1, 'Nama wajib diisi').max(150),
  username: z.string().min(3, 'Username minimal 3 karakter').max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip'),
  kataSandi: z.string().min(6, 'Kata sandi minimal 6 karakter').max(200).optional(),
  statusAktif: z.boolean().default(true),
  peran: z.array(z.string().min(1)).min(1, 'Pilih minimal satu peran'),
});

export const skemaIzinPeran = z.object({
  izin: z.array(z.object({
    kodeHakAkses: z.string().min(1),
    bolehLihat: z.boolean(),
    bolehTambah: z.boolean(),
    bolehUbah: z.boolean(),
    bolehHapus: z.boolean(),
  })),
});

export const skemaPengaturan = z.object({
  nilai: z.record(z.string(), z.string()),
});
