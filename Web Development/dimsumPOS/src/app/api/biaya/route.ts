import type { NextRequest } from 'next/server';
import { bacaJson, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { normalkanRentang } from '@/lib/laporan';
import { skemaBiaya } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(permintaan: NextRequest) {
  return handler(async () => {
    await requirePermission('BIAYA', 'lihat');
    const p = permintaan.nextUrl.searchParams;
    const r = normalkanRentang(p.get('dari'), p.get('sampai'));

    const baris = await query(
      `SELECT b.id_biaya::text, b.tanggal_biaya, b.kategori_biaya, b.keterangan,
              b.jumlah::text, u.nama_pengguna
         FROM biaya_operasional b
         JOIN pengguna u ON u.id_pengguna = b.id_pengguna
        WHERE b.tanggal_biaya >= ($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
          AND b.tanggal_biaya <  (($2::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
        ORDER BY b.tanggal_biaya DESC`,
      [r.dari, r.sampai],
    );
    return sukses(baris);
  });
}

export function POST(permintaan: NextRequest) {
  return handler(async () => {
    const { sesi } = await requirePermission('BIAYA', 'tambah');
    const isi = skemaBiaya.parse(await bacaJson(permintaan));

    const baris = await querySatu<{ id_biaya: string }>(
      `INSERT INTO biaya_operasional (tanggal_biaya, kategori_biaya, keterangan, jumlah, id_pengguna)
       VALUES (COALESCE($1::timestamptz, now()), $2, $3, $4, $5)
       RETURNING id_biaya::text`,
      [isi.tanggalBiaya ?? null, isi.kategoriBiaya, isi.keterangan ?? null, isi.jumlah, sesi.idPengguna],
    );
    return sukses({ idBiaya: baris!.id_biaya }, 201);
  });
}
