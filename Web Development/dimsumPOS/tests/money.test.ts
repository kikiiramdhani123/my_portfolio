import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  d, tambah, kurang, kali, bagi, bulatkanUang, keUang, keKuantitas, jumlahkan, formatRupiah,
} from '../src/lib/money';

/** tasks.md tugas 5 — aritmetika uang tidak boleh memakai floating point. */

test('penjumlahan desimal bebas galat floating point', () => {
  assert.equal(keUang(tambah(d('0.1'), d('0.2'))), '0.30');
  assert.equal(keUang(jumlahkan([d('1500.55'), d('2499.45')])), '4000.00');
});

test('perkalian dan pembagian menjaga presisi', () => {
  // 1 PAX = 50 PCS seharga Rp75.000 → Rp1.500 per PCS
  assert.equal(keUang(bagi(d('75000'), d('50'))), '1500.00');
  assert.equal(keUang(kali(d('1500'), d('50'))), '75000.00');
});

test('pembagian tidak bulat tetap presisi tinggi lalu dibulatkan sekali', () => {
  const hpp = bagi(d('10000'), d('3'));           // 3333.333333333333
  assert.equal(keUang(bulatkanUang(hpp)), '3333.33');
  // Total 3 unit kembali ke 10.000 karena pembulatan hanya dilakukan di akhir.
  assert.equal(keUang(kali(hpp, d('3'))), '10000.00');
});

test('pembulatan half-up', () => {
  assert.equal(keUang(d('0.125')), '0.13');
  assert.equal(keUang(d('0.124')), '0.12');
  assert.equal(keUang(d('-0.125')), '-0.13');
});

test('kuantitas ditulis dengan 6 desimal', () => {
  assert.equal(keKuantitas(d('2.5')), '2.500000');
  assert.equal(keKuantitas(kali(d('0.5'), d('3'))), '1.500000');
});

test('pengurangan negatif ditangani benar', () => {
  assert.equal(keUang(kurang(d('1000'), d('2500'))), '-1500.00');
});

test('format rupiah gaya Indonesia', () => {
  // Sebagian versi ICU menyisipkan spasi setelah simbol mata uang — abaikan spasi.
  assert.equal(formatRupiah('15000').replace(/\s/g, ''), 'Rp15.000');
});

test('nilai tidak sah ditolak', () => {
  assert.throws(() => d('abc'));
  assert.equal(keUang(d(null)), '0.00');
});
