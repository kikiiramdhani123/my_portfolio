import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Lapisan keamanan pertama (Design §1): tolak permintaan tanpa sesi valid.
 * Lapisan berikutnya (layout admin & requirePermission di tiap API) tetap wajib.
 */

const PUBLIK = ['/login', '/api/auth/login', '/manifest.webmanifest', '/sw.js'];

export async function middleware(permintaan: NextRequest) {
  const { pathname } = permintaan.nextUrl;

  if (PUBLIK.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = permintaan.cookies.get('pos_sesi')?.value;
  const sesiValid = token ? await periksa(token) : false;

  if (sesiValid) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sesi tidak ditemukan atau kedaluwarsa.' }, { status: 401 });
  }

  const tujuan = permintaan.nextUrl.clone();
  tujuan.pathname = '/login';
  tujuan.search = pathname === '/' ? '' : `?lanjut=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(tujuan);
}

async function periksa(token: string): Promise<boolean> {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(rahasia));
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ikon-.*\\.png|.*\\.svg).*)'],
};
