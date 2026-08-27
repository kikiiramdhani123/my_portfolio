import { GalatAplikasi, handler, sukses } from '@/lib/api';
import { query, querySatu } from '@/lib/db';
import { punyaIzin, requirePermission, sanitasiRahasia } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ id: string }>;
}

/** Detail satu transaksi — dipakai untuk cetak struk. */
export function GET(_permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    const { sesi, izin } = await requirePermission('PENJUALAN', 'lihat');
    const { id } = await ktx.params;
    const semua = punyaIzin(izin, 'LAPORAN_LABA', 'lihat');

    const header = await querySatu(
      `SELECT p.id_penjualan::text, p.nomor_transaksi, p.tanggal_penjualan,
              p.subtotal::text, p.diskon::text, p.pajak::text, p.total_penjualan::text,
              p.jumlah_bayar::text, p.jumlah_kembalian::text, p.metode_pembayaran,
              p.status_penjualan, p.catatan, u.nama_pengguna
         FROM penjualan p
         JOIN pengguna u ON u.id_pengguna = p.id_pengguna
        WHERE p.id_penjualan = $1
          AND ($2::boolean OR p.id_pengguna = $3)`,
      [id, semua, sesi.idPengguna],
    );
    if (!header) throw new GalatAplikasi(404, 'Transaksi tidak ditemukan.');

    const detail = await query(
      `SELECT d.id_detail_penjualan::text, b.nama_barang, b.kode_barang, s.kode_satuan,
              d.jumlah::text, d.harga_jual_satuan::text, d.diskon_baris::text,
              d.subtotal_penjualan::text, d.hpp_satuan::text, d.total_hpp::text,
              d.laba_kotor::text
         FROM detail_penjualan d
         JOIN barang b ON b.id_barang = d.id_barang
         JOIN satuan s ON s.id_satuan = d.id_satuan
        WHERE d.id_penjualan = $1
        ORDER BY d.id_detail_penjualan`,
      [id],
    );

    const pengaturan = await query<{ kunci: string; nilai: string }>(
      'SELECT kunci, nilai FROM pengaturan',
    );

    return sukses(
      sanitasiRahasia(
        { header, detail, pengaturan: Object.fromEntries(pengaturan.map((p) => [p.kunci, p.nilai])) },
        izin,
      ),
    );
  });
}
