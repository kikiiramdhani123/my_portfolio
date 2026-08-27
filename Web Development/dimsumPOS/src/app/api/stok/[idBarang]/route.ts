import { GalatAplikasi, handler, sukses } from '@/lib/api';
import { klienPool, querySatu } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { kartuStok, posisiStok } from '@/lib/stok';
import { keUang, keKuantitas } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Konteks {
  params: Promise<{ idBarang: string }>;
}

export function GET(_p: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('STOK', 'lihat');
    const { idBarang } = await ktx.params;

    const barang = await querySatu(
      `SELECT b.id_barang::text, b.kode_barang, b.nama_barang, b.jenis_barang,
              s.kode_satuan, b.stok_minimum::text
         FROM barang b JOIN satuan s ON s.id_satuan = b.id_satuan_dasar
        WHERE b.id_barang = $1`,
      [idBarang],
    );
    if (!barang) throw new GalatAplikasi(404, 'Barang tidak ditemukan.');

    const [posisi, kartu] = await Promise.all([
      posisiStok(klienPool, idBarang),
      kartuStok(klienPool, idBarang),
    ]);

    return sukses({
      barang,
      posisi: {
        saldo: keKuantitas(posisi.saldo),
        hpp: keUang(posisi.hpp),
        nilai: keUang(posisi.nilai),
      },
      kartu,
    });
  });
}
