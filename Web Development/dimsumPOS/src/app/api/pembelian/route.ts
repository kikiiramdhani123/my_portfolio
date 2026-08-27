import type { NextRequest } from 'next/server';
import { bacaJson, handler, sukses } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { simpanPembelian } from '@/lib/pembelian';
import { skemaPembelian } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(permintaan: NextRequest) {
  return handler(async () => {
    await requirePermission('PEMBELIAN', 'lihat');
    const cari = permintaan.nextUrl.searchParams.get('cari');

    const baris = await query(
      `SELECT pb.id_pembelian::text, pb.nomor_faktur_pembelian, pb.tanggal_pembelian,
              pm.nama_pemasok, pb.subtotal::text, pb.diskon::text, pb.pajak::text,
              pb.total_pembelian::text, pb.status_pembelian, u.nama_pengguna,
              (SELECT COUNT(*) FROM detail_pembelian d WHERE d.id_pembelian = pb.id_pembelian)::text AS jumlah_baris
         FROM pembelian pb
         LEFT JOIN pemasok pm ON pm.id_pemasok = pb.id_pemasok
         JOIN pengguna u      ON u.id_pengguna = pb.id_pengguna
        WHERE ($1::text IS NULL OR pb.nomor_faktur_pembelian ILIKE '%'||$1||'%')
        ORDER BY pb.tanggal_pembelian DESC
        LIMIT 200`,
      [cari],
    );
    return sukses(baris);
  });
}

export function POST(permintaan: NextRequest) {
  return handler(async () => {
    const { sesi } = await requirePermission('PEMBELIAN', 'tambah');
    const isi = skemaPembelian.parse(await bacaJson(permintaan));

    const hasil = await withTransaction((klien) =>
      simpanPembelian(klien, isi, sesi.idPengguna),
    );
    return sukses(hasil, 201);
  });
}
