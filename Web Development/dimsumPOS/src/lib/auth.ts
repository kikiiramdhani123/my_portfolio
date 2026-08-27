import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { query, querySatu } from './db';
import { GalatAkses } from './galat';

/** Requirement: 1.1–1.8 */

const NAMA_COOKIE = 'pos_sesi';
const UMUR_SESI_DETIK = 12 * 60 * 60; // Req 1.6 — 12 jam
const BATAS_GAGAL = 10;               // Req 1.8
const JENDELA_MENIT = 10;
const BLOKIR_MENIT = 5;

export interface Sesi {
  idPengguna: string;
  username: string;
  nama: string;
  peran: string[];
}

function kunci(): Uint8Array {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 24) {
    throw new Error('SESSION_SECRET belum diatur atau terlalu pendek (minimal 24 karakter).');
  }
  return new TextEncoder().encode(rahasia);
}

export async function hashSandi(sandi: string): Promise<string> {
  return bcrypt.hash(sandi, 10); // Req 1.5
}

export async function verifikasiSandi(sandi: string, hash: string): Promise<boolean> {
  return bcrypt.compare(sandi, hash);
}

export async function buatSesi(sesi: Sesi): Promise<void> {
  const token = await new SignJWT({ ...sesi })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${UMUR_SESI_DETIK}s`)
    .sign(kunci());

  const toples = await cookies();
  toples.set(NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UMUR_SESI_DETIK,
  });
}

export async function bacaSesi(): Promise<Sesi | null> {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, kunci());
    return {
      idPengguna: String(payload.idPengguna),
      username: String(payload.username),
      nama: String(payload.nama),
      peran: Array.isArray(payload.peran) ? (payload.peran as string[]) : [],
    };
  } catch {
    return null;
  }
}

export async function hapusSesi(): Promise<void> {
  (await cookies()).delete(NAMA_COOKIE);
}

export { GalatAkses };

export async function requireUser(): Promise<Sesi> {
  const sesi = await bacaSesi();
  if (!sesi) throw new GalatAkses(401, 'Sesi tidak ditemukan atau kedaluwarsa.');
  return sesi;
}

// ── Login ──────────────────────────────────────────────────────────────

interface BarisPengguna {
  id_pengguna: string;
  nama_pengguna: string;
  username: string;
  kata_sandi_hash: string;
  status_aktif: boolean;
}

export type HasilLogin =
  | { ok: true; sesi: Sesi }
  | { ok: false; pesan: string };

export async function login(username: string, sandi: string, ip: string | null): Promise<HasilLogin> {
  if (await sedangDiblokir(username)) {
    return { ok: false, pesan: `Terlalu banyak percobaan gagal. Coba lagi dalam ${BLOKIR_MENIT} menit.` };
  }

  const pengguna = await querySatu<BarisPengguna>(
    `SELECT id_pengguna::text, nama_pengguna, username, kata_sandi_hash, status_aktif
       FROM pengguna WHERE lower(username) = lower($1)`,
    [username],
  );

  const cocok = pengguna ? await verifikasiSandi(sandi, pengguna.kata_sandi_hash) : false;
  await catatPercobaan(username, cocok && !!pengguna?.status_aktif, ip);

  // Req 1.3 — pesan generik, tidak mengungkap field mana yang salah.
  if (!pengguna || !cocok) return { ok: false, pesan: 'Username atau kata sandi salah.' };
  // Req 1.4
  if (!pengguna.status_aktif) return { ok: false, pesan: 'Akun dinonaktifkan. Hubungi pemilik.' };

  const peran = await query<{ nama_peran: string }>(
    `SELECT p.nama_peran FROM pengguna_peran pp
       JOIN peran p ON p.id_peran = pp.id_peran
      WHERE pp.id_pengguna = $1`,
    [pengguna.id_pengguna],
  );

  return {
    ok: true,
    sesi: {
      idPengguna: pengguna.id_pengguna,
      username: pengguna.username,
      nama: pengguna.nama_pengguna,
      peran: peran.map((r) => r.nama_peran),
    },
  };
}

async function catatPercobaan(username: string, berhasil: boolean, ip: string | null): Promise<void> {
  await query(
    'INSERT INTO percobaan_login (username, berhasil, ip) VALUES ($1, $2, $3)',
    [username, berhasil, ip],
  );
}

async function sedangDiblokir(username: string): Promise<boolean> {
  const baris = await querySatu<{ gagal: string }>(
    `SELECT COUNT(*)::text AS gagal
       FROM percobaan_login
      WHERE lower(username) = lower($1)
        AND NOT berhasil
        AND waktu > now() - ($2 || ' minutes')::interval`,
    [username, String(JENDELA_MENIT)],
  );
  return Number(baris?.gagal ?? '0') >= BATAS_GAGAL;
}

export const KONSTANTA_AUTH = { NAMA_COOKIE, UMUR_SESI_DETIK, BATAS_GAGAL, BLOKIR_MENIT };
