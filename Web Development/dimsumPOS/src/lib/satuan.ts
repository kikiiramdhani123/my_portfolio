import { d, kali, bagi, type Desimal } from './money';

/**
 * Konversi antara satuan input dan satuan dasar barang.
 * Requirement: 3.4, 4.3 · tech.md aturan 6
 */

/** jumlah pada satuan input → jumlah pada satuan dasar. */
export function keSatuanDasar(
  jumlah: string | number | Desimal,
  konversi: string | number | Desimal,
): Desimal {
  return kali(d(jumlah as string), d(konversi as string));
}

/** jumlah pada satuan dasar → jumlah pada satuan input. */
export function dariSatuanDasar(
  jumlahDasar: string | number | Desimal,
  konversi: string | number | Desimal,
): Desimal {
  return bagi(d(jumlahDasar as string), d(konversi as string));
}

/** Harga per satuan input → harga per satuan dasar (mis. Rp50.000/PAX ÷ 50 = Rp1.000/PCS). */
export function hargaPerSatuanDasar(
  hargaSatuanInput: string | number | Desimal,
  konversi: string | number | Desimal,
): Desimal {
  return bagi(d(hargaSatuanInput as string), d(konversi as string));
}
