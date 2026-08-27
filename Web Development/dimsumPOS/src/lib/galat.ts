/**
 * Kelas galat domain — sengaja tanpa 'server-only' dan tanpa import Next,
 * agar lib bisnis (stok, penjualan, pembelian, resep) dapat diuji di Node murni.
 */

export class GalatAplikasi extends Error {
  constructor(readonly status: number, pesan: string, readonly detail?: unknown) {
    super(pesan);
    this.name = 'GalatAplikasi';
  }
}

export class GalatAkses extends Error {
  constructor(readonly status: 401 | 403, pesan: string) {
    super(pesan);
    this.name = 'GalatAkses';
  }
}
