import './persiapan';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool, withTransaction, type Klien } from '../src/lib/db';
import { posisiStok } from '../src/lib/stok';
import { simpanPembelian } from '../src/lib/pembelian';
import { selesaikanPenjualan } from '../src/lib/penjualan';
import { keKuantitas } from '../src/lib/money';

/**
 * Verifikasi model kemasan bertingkat Dimsum Original:
 * bahan mentah proporsional per pcs + produk "Kemasan …" yang diketuk sekali per order.
 */

class Batalkan extends Error {}
async function dalamTransaksiTerbalik(fn: (klien: Klien) => Promise<void>): Promise<void> {
  await withTransaction(async (klien) => {
    await fn(klien);
    throw new Batalkan('rollback disengaja');
  }).catch((galat: unknown) => {
    if (!(galat instanceof Batalkan)) throw galat;
  });
}

async function id(klien: Klien, tabel: 'barang' | 'satuan', kolom: string, nilai: string): Promise<string> {
  const baris = await klien.satu<{ id: string }>(
    `SELECT ${tabel === 'barang' ? 'id_barang' : 'id_satuan'}::text AS id FROM ${tabel} WHERE ${kolom} = $1`,
    [nilai],
  );
  if (!baris) throw new Error(`${tabel}.${kolom}=${nilai} tidak ditemukan`);
  return baris.id;
}

test('order kecil (3 pcs) memakai mika biasa, bukan mika besar', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = (await klien.satu<{ id: string }>(
      "SELECT id_pengguna::text AS id FROM pengguna WHERE username='owner'",
    ))!.id;
    const pcs = await id(klien, 'satuan', 'kode_satuan', 'PCS');

    // Isi stok bahan agar HPP terbentuk.
    for (const [kode, satuanBeli, jumlah, harga] of [
      ['BHN-DIM', 'DUS', '1', '100000'],
      ['BHN-SAU', 'LITER', '1', '30000'],
      ['KEM-MIK', 'PACK', '1', '15000'],
      ['KEM-MIK-BSR', 'PACK', '1', '20000'],
      ['KEM-PLA', 'PACK', '1', '12000'],
      ['KEM-TUS', 'PACK', '1', '8000'],
    ] as const) {
      await simpanPembelian(klien, {
        nomorFaktur: `UJI-KMS-${kode}-${Date.now()}`,
        status: 'SELESAI',
        detail: [{ idBarang: await id(klien, 'barang', 'kode_barang', kode), idSatuan: await id(klien, 'satuan', 'kode_satuan', satuanBeli), jumlah, hargaBeliSatuan: harga }],
      }, pengguna);
    }

    const dimOri = await id(klien, 'barang', 'kode_barang', 'DIM-ORI');
    const kemasanKecil = await id(klien, 'barang', 'kode_barang', 'KEM-ORDER-KCL');
    const mikaBiasaSebelum = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK'));
    const mikaBesarSebelum = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK-BSR'));
    const dimFrozenSebelum = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'BHN-DIM'));

    // Kasir: ketuk Dimsum Original 3x (qty=3), lalu ketuk Kemasan ≤4pcs 1x.
    await selesaikanPenjualan(klien, {
      detail: [
        { idBarang: dimOri, idSatuan: pcs, jumlah: '3' },
        { idBarang: kemasanKecil, idSatuan: pcs, jumlah: '1' },
      ],
      metodePembayaran: 'TUNAI',
      jumlahBayar: '99999',
    }, pengguna);

    const dimFrozenSesudah = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'BHN-DIM'));
    const mikaBiasaSesudah = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK'));
    const mikaBesarSesudah = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK-BSR'));

    assert.equal(
      keKuantitas(dimFrozenSebelum.saldo - dimFrozenSesudah.saldo), '3.000000',
      'dimsum frozen berkurang tepat 3 pcs (proporsional, bukan kelipatan 4)',
    );
    assert.equal(
      keKuantitas(mikaBiasaSebelum.saldo - mikaBiasaSesudah.saldo), '1.000000',
      'mika biasa berkurang 1 (dari produk Kemasan ≤4pcs)',
    );
    assert.equal(
      keKuantitas(mikaBesarSebelum.saldo - mikaBesarSesudah.saldo), '0.000000',
      'mika besar TIDAK terpakai untuk order kecil',
    );
  });
});

test('order besar (6 pcs) memakai mika besar via Kemasan 5+pcs', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = (await klien.satu<{ id: string }>(
      "SELECT id_pengguna::text AS id FROM pengguna WHERE username='owner'",
    ))!.id;
    const pcs = await id(klien, 'satuan', 'kode_satuan', 'PCS');

    for (const [kode, satuanBeli, jumlah, harga] of [
      ['BHN-DIM', 'DUS', '1', '100000'],
      ['BHN-SAU', 'LITER', '1', '30000'],
      ['KEM-MIK-BSR', 'PACK', '1', '20000'],
      ['KEM-PLA', 'PACK', '1', '12000'],
      ['KEM-TUS', 'PACK', '1', '8000'],
    ] as const) {
      await simpanPembelian(klien, {
        nomorFaktur: `UJI-KMB-${kode}-${Date.now()}`,
        status: 'SELESAI',
        detail: [{ idBarang: await id(klien, 'barang', 'kode_barang', kode), idSatuan: await id(klien, 'satuan', 'kode_satuan', satuanBeli), jumlah, hargaBeliSatuan: harga }],
      }, pengguna);
    }

    const dimOri = await id(klien, 'barang', 'kode_barang', 'DIM-ORI');
    const kemasanBesar = await id(klien, 'barang', 'kode_barang', 'KEM-ORDER-BSR');
    const mikaBesarSebelum = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK-BSR'));
    const sausSebelum = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'BHN-SAU'));

    // Kasir: ketuk Dimsum Original 6x, lalu ketuk Kemasan 5+pcs 1x.
    await selesaikanPenjualan(klien, {
      detail: [
        { idBarang: dimOri, idSatuan: pcs, jumlah: '6' },
        { idBarang: kemasanBesar, idSatuan: pcs, jumlah: '1' },
      ],
      metodePembayaran: 'TUNAI',
      jumlahBayar: '99999',
    }, pengguna);

    const mikaBesarSesudah = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'KEM-MIK-BSR'));
    const sausSesudah = await posisiStok(klien, await id(klien, 'barang', 'kode_barang', 'BHN-SAU'));

    assert.equal(keKuantitas(mikaBesarSebelum.saldo - mikaBesarSesudah.saldo), '1.000000', 'mika besar terpakai 1');
    // Saus proporsional: 2.5 ml x 6 pcs = 15 ml
    assert.equal(keKuantitas(sausSebelum.saldo - sausSesudah.saldo), '15.000000', 'saus proporsional 2,5ml x 6pcs = 15ml');
  });
});

test.after(async () => { await pool.end(); });
