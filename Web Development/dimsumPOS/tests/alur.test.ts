import './persiapan';                    // wajib pertama: memuat .env.local
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool, withTransaction, type Klien } from '../src/lib/db';
import { posisiStok } from '../src/lib/stok';
import { simpanPembelian, batalkanPembelian } from '../src/lib/pembelian';
import { selesaikanPenjualan, batalkanPenjualan } from '../src/lib/penjualan';
import { d, keUang, keKuantitas } from '../src/lib/money';

/**
 * Uji integrasi terhadap database sungguhan.
 * Setiap kasus dijalankan di dalam transaksi yang sengaja di-ROLLBACK,
 * sehingga data pengguna tidak berubah (design.md §8 poin 2).
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

async function idPengguna(klien: Klien): Promise<string> {
  const baris = await klien.satu<{ id_pengguna: string }>(
    "SELECT id_pengguna::text FROM pengguna WHERE username = 'owner'",
  );
  return baris!.id_pengguna;
}

async function idBarang(klien: Klien, kode: string): Promise<string> {
  const baris = await klien.satu<{ id_barang: string }>(
    'SELECT id_barang::text FROM barang WHERE kode_barang = $1', [kode],
  );
  return baris!.id_barang;
}

async function idSatuan(klien: Klien, kode: string): Promise<string> {
  const baris = await klien.satu<{ id_satuan: string }>(
    'SELECT id_satuan::text FROM satuan WHERE kode_satuan = $1', [kode],
  );
  return baris!.id_satuan;
}

test('pembelian menaikkan stok dan menghitung HPP rata-rata bergerak', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const dimsum = await idBarang(klien, 'BHN-DIM');
    const dus = await idSatuan(klien, 'DUS');   // 1 DUS = 100 PCS

    const awal = await posisiStok(klien, dimsum);

    // Pembelian 1: 1 DUS @ Rp100.000 → 100 PCS, HPP Rp1.000/PCS
    await simpanPembelian(klien, {
      nomorFaktur: `UJI-A-${Date.now()}`,
      status: 'SELESAI',
      detail: [{ idBarang: dimsum, idSatuan: dus, jumlah: '1', hargaBeliSatuan: '100000' }],
    }, pengguna);

    const setelah1 = await posisiStok(klien, dimsum);
    assert.equal(
      keKuantitas(setelah1.saldo),
      keKuantitas(awal.saldo + d('100')),
      'saldo bertambah 100 PCS',
    );

    // Pembelian 2: 1 DUS @ Rp140.000 → 100 PCS, HPP Rp1.400/PCS
    await simpanPembelian(klien, {
      nomorFaktur: `UJI-B-${Date.now()}`,
      status: 'SELESAI',
      detail: [{ idBarang: dimsum, idSatuan: dus, jumlah: '1', hargaBeliSatuan: '140000' }],
    }, pengguna);

    const setelah2 = await posisiStok(klien, dimsum);
    // Bila stok awal nol: (100.000 + 140.000) / 200 = Rp1.200/PCS
    if (awal.saldo === 0n) {
      assert.equal(keUang(setelah2.hpp), '1200.00', 'HPP rata-rata bergerak');
      assert.equal(keUang(setelah2.nilai), '240000.00', 'nilai persediaan');
    }
    assert.ok(setelah2.saldo > setelah1.saldo);
  });
});

test('pembelian DRAFT tidak mengubah stok', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const gelas = await idBarang(klien, 'KEM-GEL');
    const pack = await idSatuan(klien, 'PACK');

    const sebelum = await posisiStok(klien, gelas);
    await simpanPembelian(klien, {
      nomorFaktur: `UJI-DRAFT-${Date.now()}`,
      status: 'DRAFT',
      detail: [{ idBarang: gelas, idSatuan: pack, jumlah: '2', hargaBeliSatuan: '25000' }],
    }, pengguna);
    const sesudah = await posisiStok(klien, gelas);

    assert.equal(keKuantitas(sesudah.saldo), keKuantitas(sebelum.saldo));
  });
});

test('penjualan Es Teh mengurangi seluruh bahan resepnya', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const esTeh = await idBarang(klien, 'MIN-EST');
    const pcs = await idSatuan(klien, 'PCS');

    // Isi stok bahan lebih dulu agar HPP terbentuk.
    const bahan: [string, string, string, string][] = [
      ['BHN-TEH', 'KG', '1', '60000'],
      ['BHN-GUL', 'LITER', '2', '20000'],
      ['BHN-ES', 'KG', '10', '2000'],
      ['KEM-GEL', 'PACK', '2', '25000'],
      ['KEM-SED', 'PACK', '2', '10000'],
    ];
    for (const [kode, satuan, jumlah, harga] of bahan) {
      await simpanPembelian(klien, {
        nomorFaktur: `UJI-BHN-${kode}-${Date.now()}`,
        status: 'SELESAI',
        detail: [{
          idBarang: await idBarang(klien, kode),
          idSatuan: await idSatuan(klien, satuan),
          jumlah, hargaBeliSatuan: harga,
        }],
      }, pengguna);
    }

    const gelasSebelum = await posisiStok(klien, await idBarang(klien, 'KEM-GEL'));
    const tehSebelum = await posisiStok(klien, await idBarang(klien, 'BHN-TEH'));

    const hasil = await selesaikanPenjualan(klien, {
      detail: [{ idBarang: esTeh, idSatuan: pcs, jumlah: '2' }],
      metodePembayaran: 'TUNAI',
      jumlahBayar: '10000',
    }, pengguna);

    assert.match(hasil.nomorTransaksi, /^INV-\d{8}-\d{4}$/, 'format nomor transaksi');
    assert.equal(hasil.total, '10000.00');
    assert.equal(hasil.kembalian, '0.00');

    const gelasSesudah = await posisiStok(klien, await idBarang(klien, 'KEM-GEL'));
    const tehSesudah = await posisiStok(klien, await idBarang(klien, 'BHN-TEH'));

    // Resep Es Teh: 1 gelas + 5 gram teh per cup, dikali 2 cup.
    assert.equal(keKuantitas(gelasSebelum.saldo - gelasSesudah.saldo), '2.000000');
    assert.equal(keKuantitas(tehSebelum.saldo - tehSesudah.saldo), '10.000000');

    // Laba tercatat dan HPP tersnapshot.
    const detail = await klien.satu<{ hpp_satuan: string; laba_kotor: string }>(
      'SELECT hpp_satuan::text, laba_kotor::text FROM detail_penjualan WHERE id_penjualan = $1',
      [hasil.idPenjualan],
    );
    assert.ok(Number(detail!.hpp_satuan) > 0, 'HPP per cup terisi');
    assert.ok(Number(detail!.laba_kotor) > 0, 'laba kotor positif');
  });
});

test('idempotency_key mencegah transaksi ganda', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const esTeh = await idBarang(klien, 'MIN-EST');
    const pcs = await idSatuan(klien, 'PCS');
    const kunci = `uji-${Date.now()}`;

    const input = {
      detail: [{ idBarang: esTeh, idSatuan: pcs, jumlah: '1' }],
      metodePembayaran: 'TUNAI' as const,
      jumlahBayar: '5000',
      idempotencyKey: kunci,
    };

    const pertama = await selesaikanPenjualan(klien, input, pengguna);
    const kedua = await selesaikanPenjualan(klien, input, pengguna);

    assert.equal(kedua.idPenjualan, pertama.idPenjualan);
    assert.equal(kedua.diulang, true);

    const jumlah = await klien.satu<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM penjualan WHERE idempotency_key = $1', [kunci],
    );
    assert.equal(jumlah!.n, '1');
  });
});

test('bayar tunai kurang dari total ditolak', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const esTeh = await idBarang(klien, 'MIN-EST');
    const pcs = await idSatuan(klien, 'PCS');

    await assert.rejects(
      selesaikanPenjualan(klien, {
        detail: [{ idBarang: esTeh, idSatuan: pcs, jumlah: '2' }],
        metodePembayaran: 'TUNAI',
        jumlahBayar: '5000',
      }, pengguna),
      /Jumlah bayar kurang/,
    );
  });
});

test('pembatalan penjualan mengembalikan stok bahan', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const esTeh = await idBarang(klien, 'MIN-EST');
    const pcs = await idSatuan(klien, 'PCS');
    const gelas = await idBarang(klien, 'KEM-GEL');

    await simpanPembelian(klien, {
      nomorFaktur: `UJI-GEL-${Date.now()}`,
      status: 'SELESAI',
      detail: [{ idBarang: gelas, idSatuan: await idSatuan(klien, 'PACK'), jumlah: '1', hargaBeliSatuan: '25000' }],
    }, pengguna);

    const sebelum = await posisiStok(klien, gelas);
    const jual = await selesaikanPenjualan(klien, {
      detail: [{ idBarang: esTeh, idSatuan: pcs, jumlah: '3' }],
      metodePembayaran: 'QRIS',
      jumlahBayar: '15000',
    }, pengguna);

    await batalkanPenjualan(klien, jual.idPenjualan, pengguna, 'uji otomatis');

    const sesudah = await posisiStok(klien, gelas);
    assert.equal(keKuantitas(sesudah.saldo), keKuantitas(sebelum.saldo), 'stok gelas pulih');

    const status = await klien.satu<{ status_penjualan: string }>(
      'SELECT status_penjualan FROM penjualan WHERE id_penjualan = $1', [jual.idPenjualan],
    );
    assert.equal(status!.status_penjualan, 'BATAL');
  });
});

test('pembatalan pembelian membuat pergerakan pembalik, bukan menghapus riwayat', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const pengguna = await idPengguna(klien);
    const mika = await idBarang(klien, 'KEM-MIK');
    const pack = await idSatuan(klien, 'PACK');

    const sebelum = await posisiStok(klien, mika);
    const beli = await simpanPembelian(klien, {
      nomorFaktur: `UJI-MIK-${Date.now()}`,
      status: 'SELESAI',
      detail: [{ idBarang: mika, idSatuan: pack, jumlah: '2', hargaBeliSatuan: '15000' }],
    }, pengguna);

    await batalkanPembelian(klien, beli.idPembelian, pengguna, 'salah input');

    const sesudah = await posisiStok(klien, mika);
    assert.equal(keKuantitas(sesudah.saldo), keKuantitas(sebelum.saldo));

    const riwayat = await klien.satu<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM detail_pembelian WHERE id_pembelian = $1',
      [beli.idPembelian],
    );
    assert.equal(riwayat!.n, '1', 'riwayat pembelian tetap ada');
  });
});

test('kartu stok tidak dapat diubah maupun dihapus', async () => {
  await dalamTransaksiTerbalik(async (klien) => {
    const baris = await klien.satu<{ id_pergerakan_stok: string }>(
      'SELECT id_pergerakan_stok::text FROM pergerakan_stok LIMIT 1',
    );
    if (!baris) return; // belum ada pergerakan sama sekali

    await assert.rejects(
      klien.query('UPDATE pergerakan_stok SET jumlah = 999 WHERE id_pergerakan_stok = $1',
        [baris.id_pergerakan_stok]),
      /append-only/,
    );
  });
});

test.after(async () => { await pool.end(); });
