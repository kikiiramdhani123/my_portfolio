import type { NextRequest } from 'next/server';
import { bacaJson, handler, sukses } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { punyaIzin, requirePermission, sanitasiRahasia } from '@/lib/rbac';
import { selesaikanPenjualan } from '@/lib/penjualan';
import { skemaPenjualan } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Riwayat transaksi. KASIR hanya melihat transaksi hari ini miliknya sendiri (Req 6.12). */
export function GET(permintaan: NextRequest) {
  return handler(async () => {
    const { sesi, izin } = await requirePermission('PENJUALAN', 'lihat');
    const semua = punyaIzin(izin, 'LAPORAN_LABA', 'lihat');
    const cari = permintaan.nextUrl.searchParams.get('cari');

    const baris = await query(
      `SELECT p.id_penjualan::text, p.nomor_transaksi, p.tanggal_penjualan,
              p.total_penjualan::text, p.metode_pembayaran, p.status_penjualan,
              u.nama_pengguna,
              COALESCE(SUM(d.jumlah), 0)::text     AS jumlah_item,
              COALESCE(SUM(d.laba_kotor), 0)::text AS laba_kotor
         FROM penjualan p
         JOIN pengguna u ON u.id_pengguna = p.id_pengguna
         LEFT JOIN detail_penjualan d ON d.id_penjualan = p.id_penjualan
        WHERE ($1::boolean OR (p.id_pengguna = $2
               AND (p.tanggal_penjualan AT TIME ZONE 'Asia/Jakarta')::date
                   = (now() AT TIME ZONE 'Asia/Jakarta')::date))
          AND ($3::text IS NULL OR p.nomor_transaksi ILIKE '%'||$3||'%')
        GROUP BY p.id_penjualan, u.nama_pengguna
        ORDER BY p.tanggal_penjualan DESC
        LIMIT 200`,
      [semua, sesi.idPengguna, cari],
    );

    return sukses(sanitasiRahasia(baris, izin));
  });
}

/** Selesaikan transaksi (Req 6.7). */
export function POST(permintaan: NextRequest) {
  return handler(async () => {
    const { sesi } = await requirePermission('PENJUALAN', 'tambah');
    const isi = skemaPenjualan.parse(await bacaJson(permintaan));

    const hasil = await withTransaction((klien) =>
      selesaikanPenjualan(klien, isi, sesi.idPengguna),
    );

    return sukses(hasil, hasil.diulang ? 200 : 201);
  });
}
