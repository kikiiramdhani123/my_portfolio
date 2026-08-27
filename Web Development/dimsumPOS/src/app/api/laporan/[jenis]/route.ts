import type { NextRequest } from 'next/server';
import { GalatAplikasi, handler, sukses } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import {
  keCsv, labaRugi, laporanBiaya, laporanPembelian, laporanPenjualan,
  normalkanRentang, penjualanHarian, produkTerlaris, ringkasan,
} from '@/lib/laporan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ jenis: string }>;
}

/** Req 9.2–9.6 — seluruh laporan butuh hak LAPORAN_LABA. */
export function GET(permintaan: NextRequest, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('LAPORAN_LABA', 'lihat');
    const { jenis } = await ktx.params;
    const p = permintaan.nextUrl.searchParams;
    const r = normalkanRentang(p.get('dari'), p.get('sampai'));

    const data = await ambil(jenis, r);
    if (data === null) throw new GalatAplikasi(404, `Jenis laporan '${jenis}' tidak dikenal.`);

    // Req 9.4 — ekspor CSV
    if (p.get('format') === 'csv' && Array.isArray(data)) {
      return new Response(`﻿${keCsv(data as Record<string, unknown>[])}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="laporan-${jenis}-${r.dari}_${r.sampai}.csv"`,
        },
      }) as never;
    }

    return sukses({ rentang: r, hasil: data });
  });
}

async function ambil(jenis: string, r: { dari: string; sampai: string }): Promise<unknown | null> {
  switch (jenis) {
    case 'ringkasan':
      return {
        total: await ringkasan(r),
        harian: await penjualanHarian(r),
        terlaris: await produkTerlaris(r, 5),
      };
    case 'penjualan': return laporanPenjualan(r);
    case 'labarugi':  return labaRugi(r);
    case 'terlaris':  return produkTerlaris(r);
    case 'pembelian': return laporanPembelian(r);
    case 'biaya':     return laporanBiaya(r);
    default:          return null;
  }
}
