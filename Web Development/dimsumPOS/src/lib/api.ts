import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adalahPelanggaranUnik } from './db';
import { GalatAkses, GalatAplikasi } from './galat';

/** Pembungkus respons seragam: { data } | { error } — Design §5 & §7 */

export { GalatAplikasi };

export function sukses<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function gagal(pesan: string, status = 400, detail?: unknown): NextResponse {
  return NextResponse.json({ error: pesan, detail }, { status });
}

/** Bungkus handler agar seluruh galat menjadi respons JSON yang konsisten. */
export function handler(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  return fn().catch(tanganiGalat);
}

export function tanganiGalat(galat: unknown): NextResponse {
  if (galat instanceof GalatAkses) return gagal(galat.message, galat.status);
  if (galat instanceof GalatAplikasi) return gagal(galat.message, galat.status, galat.detail);

  if (galat instanceof ZodError) {
    const peta: Record<string, string> = {};
    for (const isu of galat.issues) peta[isu.path.join('.') || '_'] = isu.message;
    return gagal('Data yang dikirim tidak valid.', 422, peta);
  }

  if (adalahPelanggaranUnik(galat)) {
    return gagal(`Data duplikat: ${galat.constraint ?? 'nilai sudah dipakai'}.`, 409);
  }

  console.error('[API]', galat);
  const pesan = galat instanceof Error ? galat.message : 'Terjadi kesalahan pada server.';
  return gagal(pesan, 500);
}

export async function bacaJson(permintaan: Request): Promise<unknown> {
  try {
    return await permintaan.json();
  } catch {
    throw new GalatAplikasi(400, 'Body permintaan bukan JSON yang sah.');
  }
}
