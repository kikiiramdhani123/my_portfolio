import type { NextRequest } from 'next/server';
import { bacaJson, handler, sukses } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaBarang } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(permintaan: NextRequest) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'lihat');
    const p = permintaan.nextUrl.searchParams;
    const cari = p.get('cari');
    const jenis = p.get('jenis');

    const baris = await query(
      `WITH saldo AS (
         SELECT id_barang, SUM(arah_stok * jumlah_satuan_dasar) AS saldo
           FROM pergerakan_stok GROUP BY id_barang
       )
       SELECT b.id_barang::text, b.kode_barang, b.nama_barang, b.jenis_barang,
              b.id_satuan_dasar::text, s.kode_satuan, b.dapat_dijual, b.dapat_dibeli,
              b.status_aktif, b.stok_minimum::text, b.emoji, b.warna_kartu,
              COALESCE(sd.harga_jual, 0)::text AS harga_jual,
              COALESCE(sa.saldo, 0)::text      AS saldo
         FROM barang b
         JOIN satuan s ON s.id_satuan = b.id_satuan_dasar
         LEFT JOIN satuan_barang sd
                ON sd.id_barang = b.id_barang AND sd.id_satuan = b.id_satuan_dasar
         LEFT JOIN saldo sa ON sa.id_barang = b.id_barang
        WHERE ($1::text IS NULL OR b.nama_barang ILIKE '%'||$1||'%' OR b.kode_barang ILIKE '%'||$1||'%')
          AND ($2::text IS NULL OR b.jenis_barang = $2)
        ORDER BY b.jenis_barang, b.nama_barang`,
      [cari, jenis],
    );
    return sukses(baris);
  });
}

export function POST(permintaan: NextRequest) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'tambah');
    const isi = skemaBarang.parse(await bacaJson(permintaan));

    const id = await withTransaction(async (klien) => {
      const baris = await klien.satu<{ id_barang: string }>(
        `INSERT INTO barang (kode_barang, nama_barang, jenis_barang, id_satuan_dasar,
                             dapat_dijual, dapat_dibeli, status_aktif, stok_minimum,
                             emoji, warna_kartu)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id_barang::text`,
        [isi.kodeBarang, isi.namaBarang, isi.jenisBarang, isi.idSatuanDasar,
         isi.dapatDijual, isi.dapatDibeli, isi.statusAktif, isi.stokMinimum,
         isi.emoji ?? null, isi.warnaKartu ?? null],
      );

      // Req 3.3 — satuan dasar otomatis dibuat dengan konversi 1 dan ditandai default.
      await klien.query(
        `INSERT INTO satuan_barang
           (id_barang, id_satuan, konversi_ke_satuan_dasar, harga_jual, adalah_satuan_default)
         VALUES ($1,$2,1,$3,TRUE)`,
        [baris!.id_barang, isi.idSatuanDasar, isi.hargaJual],
      );
      return baris!.id_barang;
    });

    return sukses({ idBarang: id }, 201);
  });
}
