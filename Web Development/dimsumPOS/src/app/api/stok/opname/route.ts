import { GalatAplikasi, bacaJson, handler, sukses } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { catatPergerakan, posisiStok } from '@/lib/stok';
import { d, kali, kurang, keUang } from '@/lib/money';
import { skemaOpname } from '@/lib/validators';

export const runtime = 'nodejs';

/**
 * Stok opname — buat pergerakan PENYESUAIAN sebesar selisih stok fisik vs sistem (Req 7.4).
 * Catatan wajib diisi (ditegakkan skema zod).
 */
export function POST(permintaan: Request) {
  return handler(async () => {
    const { sesi } = await requirePermission('STOK', 'ubah');
    const isi = skemaOpname.parse(await bacaJson(permintaan));

    const hasil = await withTransaction(async (klien) => {
      const barang = await klien.satu<{ id_satuan_dasar: string }>(
        'SELECT id_satuan_dasar::text FROM barang WHERE id_barang = $1',
        [isi.idBarang],
      );
      if (!barang) throw new GalatAplikasi(404, 'Barang tidak ditemukan.');

      const posisi = await posisiStok(klien, isi.idBarang);
      const fisik = d(isi.stokFisik);
      const selisih = kurang(fisik, posisi.saldo);

      if (selisih === 0n) {
        return { selisih: '0', pesan: 'Stok fisik sudah sama dengan stok sistem.' };
      }

      const arah = selisih > 0n ? 1 : -1;
      const jumlah = selisih > 0n ? selisih : -selisih;

      await catatPergerakan(klien, {
        idBarang: isi.idBarang,
        jenis: 'PENYESUAIAN',
        referensiId: null,
        jumlah,
        idSatuan: barang.id_satuan_dasar,
        konversi: d(1),
        // Penambahan hasil opname masuk pada HPP berjalan agar rata-rata tidak berubah.
        nilaiMasuk: arah === 1 ? kali(posisi.hpp, jumlah) : undefined,
        arah,
        idPengguna: sesi.idPengguna,
        catatan: `Opname: ${isi.catatan}`,
      });

      return { selisih: keUang(selisih), pesan: 'Penyesuaian stok tercatat.' };
    });

    return sukses(hasil, 201);
  });
}
