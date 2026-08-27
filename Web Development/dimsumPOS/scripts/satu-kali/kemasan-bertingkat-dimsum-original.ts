// `muatEnv()` harus terisi sebelum modul lain (mis. lib/db) dievaluasi, karena
// lib/db membuat connection pool dari DATABASE_URL saat modulnya pertama dimuat.
// Import statis di-hoist, jadi panggil di berkas terpisah yang diimpor pertama.
import '../persiapan-env';

import { pool, withTransaction } from '../../src/lib/db';
import { simpanResep } from '../../src/lib/resep';

/**
 * Migrasi data satu-kali: memisahkan resep "Dimsum Original" menjadi
 *   1) bahan mentah proporsional per pcs (dimsum frozen + saus, ikut naik sesuai qty)
 *   2) kemasan berjenjang yang diketuk kasir sekali per pesanan:
 *        - "Kemasan Dimsum ≤4pcs" → 1 mika biasa + 1 plastik + 1 tusuk
 *        - "Kemasan Dimsum 5+pcs" → 1 mika besar (SKU baru) + 1 plastik + 1 tusuk
 *
 * Alasan: pembeli kadang beli 2/3/4/lebih pcs dimsum mentah — resep lama
 * (4 pcs terikat mati per unit jual) tidak bisa mewakili qty bebas + kemasan
 * yang tidak proporsional (baru butuh mika besar di atas 4 pcs).
 */
async function main(): Promise<void> {
  await withTransaction(async (klien) => {
    const ambilId = async (kode: string): Promise<string> => {
      const baris = await klien.satu<{ id_barang: string }>(
        'SELECT id_barang::text FROM barang WHERE kode_barang = $1', [kode],
      );
      if (!baris) throw new Error(`Barang ${kode} tidak ditemukan`);
      return baris.id_barang;
    };
    const idSat = async (kode: string): Promise<string> => {
      const baris = await klien.satu<{ id_satuan: string }>(
        'SELECT id_satuan::text FROM satuan WHERE kode_satuan = $1', [kode],
      );
      if (!baris) throw new Error(`Satuan ${kode} tidak ditemukan`);
      return baris.id_satuan;
    };

    const pcs = await idSat('PCS');
    const ml = await idSat('ML');
    const pack = await idSat('PACK');
    const dus = await idSat('DUS');

    // 1) Barang baru: Mika / Sterofoam Besar
    const mikaBesar = await klien.satu<{ id_barang: string }>(
      `INSERT INTO barang (kode_barang, nama_barang, jenis_barang, id_satuan_dasar,
                           dapat_dijual, dapat_dibeli, stok_minimum, emoji, warna_kartu)
       VALUES ('KEM-MIK-BSR','Mika / Sterofoam Besar','KEMASAN',$1,FALSE,TRUE,50,NULL,NULL)
       ON CONFLICT (kode_barang) DO UPDATE SET nama_barang = EXCLUDED.nama_barang
       RETURNING id_barang::text`,
      [pcs],
    );
    const idMikaBesar = mikaBesar!.id_barang;
    await klien.query(
      `INSERT INTO satuan_barang (id_barang,id_satuan,konversi_ke_satuan_dasar,harga_jual,adalah_satuan_default)
       VALUES ($1,$2,1,0,TRUE)
       ON CONFLICT (id_barang,id_satuan) DO NOTHING`,
      [idMikaBesar, pcs],
    );
    await klien.query(
      `INSERT INTO satuan_barang (id_barang,id_satuan,konversi_ke_satuan_dasar,harga_jual,adalah_satuan_default)
       VALUES ($1,$2,50,0,FALSE) ON CONFLICT (id_barang,id_satuan) DO NOTHING`,
      [idMikaBesar, pack],
    );
    await klien.query(
      `INSERT INTO satuan_barang (id_barang,id_satuan,konversi_ke_satuan_dasar,harga_jual,adalah_satuan_default)
       VALUES ($1,$2,500,0,FALSE) ON CONFLICT (id_barang,id_satuan) DO NOTHING`,
      [idMikaBesar, dus],
    );
    console.log('✓ Barang "Mika / Sterofoam Besar" (KEM-MIK-BSR) siap, satuan PCS/PACK(50)/DUS(500)');

    // 2) Dua "produk kemasan" yang bisa diketuk kasir (harga Rp0, hanya menghabiskan stok kemasan)
    async function buatKemasanOrder(kode: string, nama: string, emoji: string): Promise<string> {
      const b = await klien.satu<{ id_barang: string }>(
        `INSERT INTO barang (kode_barang, nama_barang, jenis_barang, id_satuan_dasar,
                             dapat_dijual, dapat_dibeli, stok_minimum, emoji, warna_kartu)
         VALUES ($1,$2,'LAINNYA',$3,TRUE,FALSE,0,$4,'lime')
         ON CONFLICT (kode_barang) DO UPDATE SET nama_barang = EXCLUDED.nama_barang
         RETURNING id_barang::text`,
        [kode, nama, pcs, emoji],
      );
      await klien.query(
        `INSERT INTO satuan_barang (id_barang,id_satuan,konversi_ke_satuan_dasar,harga_jual,adalah_satuan_default)
         VALUES ($1,$2,1,0,TRUE) ON CONFLICT (id_barang,id_satuan) DO NOTHING`,
        [b!.id_barang, pcs],
      );
      return b!.id_barang;
    }

    const idKemasanKecil = await buatKemasanOrder('KEM-ORDER-KCL', 'Kemasan Dimsum ≤4pcs', '📦');
    const idKemasanBesar = await buatKemasanOrder('KEM-ORDER-BSR', 'Kemasan Dimsum 5+pcs', '🎁');
    console.log('✓ Produk kemasan "≤4pcs" dan "5+pcs" siap diketuk di layar kasir (harga Rp0)');

    // 3) Resep tiap produk kemasan
    await simpanResep(klien, {
      idBarangHasil: idKemasanKecil,
      namaResep: 'Kemasan Dimsum Kecil (mika biasa)',
      detail: [
        { idBarangBahan: await ambilId('KEM-MIK'), idSatuan: pcs, jumlah: '1' },
        { idBarangBahan: await ambilId('KEM-PLA'), idSatuan: pcs, jumlah: '1' },
        { idBarangBahan: await ambilId('KEM-TUS'), idSatuan: pcs, jumlah: '1' },
      ],
    });
    await simpanResep(klien, {
      idBarangHasil: idKemasanBesar,
      namaResep: 'Kemasan Dimsum Besar (mika besar)',
      detail: [
        { idBarangBahan: idMikaBesar, idSatuan: pcs, jumlah: '1' },
        { idBarangBahan: await ambilId('KEM-PLA'), idSatuan: pcs, jumlah: '1' },
        { idBarangBahan: await ambilId('KEM-TUS'), idSatuan: pcs, jumlah: '1' },
      ],
    });
    console.log('✓ Resep kemasan tersimpan');

    // 4) Resep baru Dimsum Original: hanya bahan mentah proporsional per pcs, TANPA kemasan
    //    (kemasan sekarang jadi tanggung jawab produk "Kemasan Dimsum …" di atas)
    await simpanResep(klien, {
      idBarangHasil: await ambilId('DIM-ORI'),
      namaResep: 'Resep Dimsum Original (bahan mentah saja, tanpa kemasan)',
      detail: [
        { idBarangBahan: await ambilId('BHN-DIM'), idSatuan: pcs, jumlah: '1' },
        { idBarangBahan: await ambilId('BHN-SAU'), idSatuan: ml, jumlah: '2.5' },
      ],
    });
    console.log('✓ Resep Dimsum Original diperbarui: 1 pcs Dimsum Frozen + 2,5 ml Saus Sambal per pcs (tanpa kemasan)');
  });

  await pool.end();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
