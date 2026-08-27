import { bacaJson, handler, sukses } from '@/lib/api';
import { query } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { skemaSatuanBarang } from '@/lib/validators';

export const runtime = 'nodejs';

interface Konteks {
  params: Promise<{ id: string }>;
}

/** Tambah / ubah satuan alternatif barang (Req 3.4, mis. 1 PAX = 50 PCS). */
export function POST(permintaan: Request, ktx: Konteks) {
  return handler(async () => {
    await requirePermission('MASTER_BARANG', 'ubah');
    const { id } = await ktx.params;
    const isi = skemaSatuanBarang.parse(await bacaJson(permintaan));

    await query(
      `INSERT INTO satuan_barang
         (id_barang, id_satuan, konversi_ke_satuan_dasar, harga_jual, barcode, adalah_satuan_default)
       VALUES ($1,$2,$3,$4,$5,FALSE)
       ON CONFLICT (id_barang, id_satuan) DO UPDATE
         SET konversi_ke_satuan_dasar = EXCLUDED.konversi_ke_satuan_dasar,
             harga_jual = EXCLUDED.harga_jual,
             barcode    = EXCLUDED.barcode`,
      [id, isi.idSatuan, isi.konversiKeSatuanDasar, isi.hargaJual, isi.barcode || null],
    );

    return sukses({ disimpan: true }, 201);
  });
}
