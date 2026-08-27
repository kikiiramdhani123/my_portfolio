import './persiapan';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Uji otorisasi HTTP (design.md §8 poin 3).
 * Membutuhkan server berjalan: `npm run build && npm start`.
 * Jalankan dengan: npx tsx --test tests/otorisasi.test.ts
 */

const DASAR = process.env.UJI_URL ?? 'http://localhost:3000';

async function masuk(username: string, kataSandi: string): Promise<string> {
  const respons = await fetch(`${DASAR}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, kataSandi }),
    redirect: 'manual',
  });
  assert.equal(respons.status, 200, `login ${username} harus berhasil`);
  const kuki = respons.headers.getSetCookie().find((k) => k.startsWith('pos_sesi='));
  assert.ok(kuki, 'cookie sesi harus dikirim');
  return kuki.split(';')[0]!;
}

let sesiKasir = '';
let sesiOwner = '';

before(async () => {
  sesiKasir = await masuk('kasir', 'kasir123');
  sesiOwner = await masuk('owner', 'owner123');
});

const ENDPOINT_BACK_OFFICE = [
  '/api/barang',
  '/api/satuan',
  '/api/pemasok',
  '/api/pembelian',
  '/api/resep',
  '/api/stok',
  '/api/biaya',
  '/api/laporan/ringkasan',
  '/api/laporan/labarugi',
  '/api/pengguna',
  '/api/peran',
  '/api/pengaturan',
];

test('KASIR ditolak di seluruh endpoint back office', async () => {
  for (const jalur of ENDPOINT_BACK_OFFICE) {
    const respons = await fetch(`${DASAR}${jalur}`, { headers: { cookie: sesiKasir } });
    assert.equal(respons.status, 403, `${jalur} harus 403 untuk KASIR`);
  }
});

test('OWNER diterima di seluruh endpoint back office', async () => {
  for (const jalur of ENDPOINT_BACK_OFFICE) {
    const respons = await fetch(`${DASAR}${jalur}`, { headers: { cookie: sesiOwner } });
    assert.equal(respons.status, 200, `${jalur} harus 200 untuk OWNER`);
  }
});

test('tanpa sesi seluruh API menolak dengan 401', async () => {
  for (const jalur of ['/api/katalog', '/api/barang', '/api/penjualan']) {
    const respons = await fetch(`${DASAR}${jalur}`);
    assert.equal(respons.status, 401, `${jalur} harus 401 tanpa sesi`);
  }
});

test('KASIR boleh membaca katalog tetapi tanpa data HPP', async () => {
  const respons = await fetch(`${DASAR}/api/katalog`, { headers: { cookie: sesiKasir } });
  assert.equal(respons.status, 200);
  const teks = await respons.text();
  for (const rahasia of ['hpp', 'harga_beli', 'laba_kotor', 'nilai_persediaan']) {
    assert.equal(teks.includes(rahasia), false, `katalog tidak boleh memuat '${rahasia}'`);
  }
});

test('KASIR tidak melihat kolom laba pada riwayat penjualannya', async () => {
  const respons = await fetch(`${DASAR}/api/penjualan`, { headers: { cookie: sesiKasir } });
  assert.equal(respons.status, 200);
  const teks = await respons.text();
  assert.equal(teks.includes('laba_kotor'), false, 'field laba_kotor harus dipangkas');
});

test('KASIR tidak dapat membatalkan transaksi', async () => {
  const respons = await fetch(`${DASAR}/api/penjualan/1/batal`, {
    method: 'POST',
    headers: { cookie: sesiKasir, 'Content-Type': 'application/json' },
    body: JSON.stringify({ alasan: 'percobaan tidak sah' }),
  });
  assert.equal(respons.status, 403);
});

test('halaman /admin menolak KASIR', async () => {
  const respons = await fetch(`${DASAR}/admin`, { headers: { cookie: sesiKasir } });
  const isi = await respons.text();
  assert.ok(isi.includes('Akses ditolak'), 'halaman admin harus menampilkan Akses ditolak');
});

test('login salah memberi pesan generik', async () => {
  const respons = await fetch(`${DASAR}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', kataSandi: 'salah-sekali' }),
  });
  assert.equal(respons.status, 401);
  const isi = await respons.json() as { error: string };
  assert.match(isi.error, /Username atau kata sandi salah/);
});
