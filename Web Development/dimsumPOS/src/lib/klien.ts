'use client';

/** Pembungkus fetch sisi klien: selalu membaca bentuk { data } | { error }. */

class GalatApi extends Error {
  constructor(pesan: string, readonly status: number, readonly detail?: unknown) {
    super(pesan);
    this.name = 'GalatApi';
  }
}

export async function api<T>(
  jalur: string,
  opsi: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...sisa } = opsi;
  const respons = await fetch(jalur, {
    ...sisa,
    headers: { 'Content-Type': 'application/json', ...(sisa.headers ?? {}) },
    body: json === undefined ? sisa.body : JSON.stringify(json),
    cache: 'no-store',
  });

  if (respons.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login';
    throw new GalatApi('Sesi berakhir.', 401);
  }

  const isi: unknown = await respons.json().catch(() => null);

  if (!respons.ok) {
    const pesanDasar = isi && typeof isi === 'object' && 'error' in isi
      ? String((isi as { error: unknown }).error)
      : `Permintaan gagal (${respons.status}).`;
    const detail = isi && typeof isi === 'object' && 'detail' in isi
      ? (isi as { detail: unknown }).detail
      : undefined;

    // Untuk galat validasi (422), server mengirim peta { field: pesan } di `detail`.
    // Ditambahkan ke pesan agar pengguna tahu kolom mana yang salah, bukan hanya
    // pesan generik "Data yang dikirim tidak valid.".
    const rincian = detail && typeof detail === 'object' && !Array.isArray(detail)
      ? Object.values(detail as Record<string, unknown>).filter((v) => typeof v === 'string')
      : [];
    const pesan = rincian.length > 0 ? `${pesanDasar} ${rincian.join(' · ')}` : pesanDasar;

    throw new GalatApi(pesan, respons.status, detail);
  }

  return (isi as { data: T }).data;
}

export const formatRupiah = (nilai: string | number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(nilai || 0));

export const formatAngka = (nilai: string | number): string => {
  const angka = Number(nilai || 0);
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(angka);
};

export const formatWaktu = (nilai: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai));

export const formatTanggal = (nilai: string): string =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' })
    .format(new Date(nilai));

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD untuk input[type=date]. */
export function hariIni(): string {
  const kini = new Date();
  return new Date(kini.getTime() - kini.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function awalBulan(): string {
  return `${hariIni().slice(0, 7)}-01`;
}
