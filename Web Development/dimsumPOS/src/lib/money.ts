/**
 * Aritmetika desimal presisi tetap berbasis BigInt.
 *
 * Semua nilai uang & kuantitas dari PostgreSQL tiba sebagai string (lihat lib/db.ts).
 * Modul ini memprosesnya tanpa pernah menyentuh floating point, sehingga
 * 0.1 + 0.2 benar-benar 0.3 dan total laporan = jumlah laba per baris.
 *
 * Representasi internal: BigInt berskala `SKALA` (10^12) desimal.
 * Requirement: tech.md aturan 1, Design §3.1
 */

const SKALA = 12;
const FAKTOR = 10n ** BigInt(SKALA);

export type Desimal = bigint;

/** Nilai apa pun (string dari pg, number dari form, Desimal) → Desimal. */
export function d(nilai: string | number | bigint | null | undefined): Desimal {
  if (nilai === null || nilai === undefined || nilai === '') return 0n;
  if (typeof nilai === 'bigint') return nilai;

  const teks = String(nilai).trim();
  if (!/^-?\d*(\.\d*)?$/.test(teks)) {
    throw new Error(`Bukan angka desimal yang sah: ${JSON.stringify(nilai)}`);
  }
  const negatif = teks.startsWith('-');
  const absolut = negatif ? teks.slice(1) : teks;
  const [utuh = '0', pecahan = ''] = absolut.split('.');
  const pecahanTerpotong = pecahan.slice(0, SKALA).padEnd(SKALA, '0');
  const hasil = BigInt(utuh || '0') * FAKTOR + BigInt(pecahanTerpotong || '0');
  return negatif ? -hasil : hasil;
}

export const tambah = (a: Desimal, b: Desimal): Desimal => a + b;
export const kurang = (a: Desimal, b: Desimal): Desimal => a - b;
export const kali = (a: Desimal, b: Desimal): Desimal => (a * b) / FAKTOR;

export function bagi(a: Desimal, b: Desimal): Desimal {
  if (b === 0n) return 0n;
  return (a * FAKTOR) / b;
}

export const maks = (a: Desimal, b: Desimal): Desimal => (a > b ? a : b);

export function jumlahkan(nilai: readonly Desimal[]): Desimal {
  return nilai.reduce((total, n) => total + n, 0n);
}

/** Pembulatan half-up ke `desimal` angka di belakang koma. */
export function bulatkan(nilai: Desimal, desimal: number): Desimal {
  if (desimal >= SKALA) return nilai;
  const pembagi = 10n ** BigInt(SKALA - desimal);
  const negatifkan = nilai < 0n;
  const absolut = negatifkan ? -nilai : nilai;
  const sisa = absolut % pembagi;
  let hasil = absolut - sisa;
  if (sisa * 2n >= pembagi) hasil += pembagi;
  return negatifkan ? -hasil : hasil;
}

/** Bulatkan ke 2 desimal — dipakai tepat sebelum menulis kolom uang NUMERIC(18,2). */
export const bulatkanUang = (nilai: Desimal): Desimal => bulatkan(nilai, 2);

/** Desimal → string siap dikirim ke PostgreSQL sebagai parameter NUMERIC. */
function keTeks(nilai: Desimal, desimal = SKALA): string {
  const dibulatkan = bulatkan(nilai, desimal);
  const negatifkan = dibulatkan < 0n;
  const absolut = negatifkan ? -dibulatkan : dibulatkan;
  const utuh = absolut / FAKTOR;
  const pecahan = (absolut % FAKTOR).toString().padStart(SKALA, '0').slice(0, desimal);
  const tanda = negatifkan ? '-' : '';
  return desimal === 0 ? `${tanda}${utuh}` : `${tanda}${utuh}.${pecahan}`;
}

/** Untuk kolom uang NUMERIC(18,2). */
export const keUang = (nilai: Desimal): string => keTeks(nilai, 2);
/** Untuk kolom kuantitas NUMERIC(18,6). */
export const keKuantitas = (nilai: Desimal): string => keTeks(nilai, 6);

/** Desimal → number. Hanya untuk tampilan/grafik, tidak pernah untuk perhitungan. */
const keAngka = (nilai: Desimal): number => Number(keTeks(nilai, 6));

/** "15000.00" → "Rp15.000" */
export function formatRupiah(nilai: string | number | Desimal, tampilkanDesimal = false): string {
  const angka = keAngka(d(typeof nilai === 'bigint' ? keTeks(nilai) : nilai));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: tampilkanDesimal ? 2 : 0,
    maximumFractionDigits: tampilkanDesimal ? 2 : 0,
  }).format(angka);
}
