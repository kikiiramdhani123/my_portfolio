import { muatEnv } from './env';
import bcrypt from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';
import { seedHakAkses, seedPeranIzin } from './seed-bersama';

muatEnv();

/**
 * Seed MODE CONTOH — data pondasi + katalog contoh dimsum & es teh siap pakai.
 * Cocok untuk uji coba/demo. Untuk mulai bisnis nyata dari nol tanpa data
 * contoh, pakai `npm run db:seed:kosong` (lihat scripts/seed-kosong.ts).
 * Requirement 2.1, 3.2, 3.8, 5.1 · tasks.md tugas 4
 */

const SATUAN: ReadonlyArray<[string, string]> = [
  ['PCS', 'Pieces'],
  ['PORSI', 'Porsi'],
  ['PAX', 'Pax'],
  ['DUS', 'Dus'],
  ['PACK', 'Pack'],
  ['GRAM', 'Gram'],
  ['KG', 'Kilogram'],
  ['ML', 'Mililiter'],
  ['LITER', 'Liter'],
  ['LEMBAR', 'Lembar'],
];

interface DefBarang {
  kode: string;
  nama: string;
  jenis: 'MAKANAN' | 'MINUMAN' | 'BAHAN' | 'KEMASAN' | 'LAINNYA';
  satuanDasar: string;
  dapatDijual: boolean;
  hargaJual?: number;
  stokMinimum?: number;
  emoji?: string;
  warna?: string;
  /** Satuan pembelian tambahan: [kodeSatuan, isi dalam satuan dasar] */
  satuanBeli?: ReadonlyArray<[string, number]>;
}

const BARANG: readonly DefBarang[] = [
  // ── Produk jual: Dimsum ──
  { kode: 'DIM-ORI', nama: 'Dimsum Original', jenis: 'MAKANAN', satuanDasar: 'PORSI', dapatDijual: true, hargaJual: 12000, emoji: '🥟', warna: 'amber' },
  { kode: 'DIM-MEN', nama: 'Dimsum Mentai', jenis: 'MAKANAN', satuanDasar: 'PORSI', dapatDijual: true, hargaJual: 15000, emoji: '🍤', warna: 'orange' },
  { kode: 'DIM-BAK', nama: 'Dimsum Bakar', jenis: 'MAKANAN', satuanDasar: 'PORSI', dapatDijual: true, hargaJual: 14000, emoji: '🔥', warna: 'rose' },
  { kode: 'DIM-MIN', nama: 'Dimsum Mini', jenis: 'MAKANAN', satuanDasar: 'PORSI', dapatDijual: true, hargaJual: 10000, emoji: '🥠', warna: 'lime' },
  { kode: 'DIM-BDY', nama: 'Dimsum Birthday', jenis: 'MAKANAN', satuanDasar: 'PORSI', dapatDijual: true, hargaJual: 25000, emoji: '🎂', warna: 'violet' },
  // ── Produk jual: Minuman ──
  { kode: 'MIN-EST', nama: 'Es Teh', jenis: 'MINUMAN', satuanDasar: 'PCS', dapatDijual: true, hargaJual: 5000, emoji: '🧋', warna: 'sky' },

  // ── Bahan ──
  { kode: 'BHN-DIM', nama: 'Dimsum Frozen', jenis: 'BAHAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['DUS', 100], ['PACK', 20]] },
  { kode: 'BHN-TEH', nama: 'Teh Serbuk', jenis: 'BAHAN', satuanDasar: 'GRAM', dapatDijual: false, stokMinimum: 500, satuanBeli: [['KG', 1000], ['PACK', 250]] },
  { kode: 'BHN-GUL', nama: 'Gula Cair', jenis: 'BAHAN', satuanDasar: 'ML', dapatDijual: false, stokMinimum: 2000, satuanBeli: [['LITER', 1000]] },
  { kode: 'BHN-ES', nama: 'Es Batu', jenis: 'BAHAN', satuanDasar: 'GRAM', dapatDijual: false, stokMinimum: 5000, satuanBeli: [['KG', 1000]] },
  { kode: 'BHN-SAU', nama: 'Saus Sambal', jenis: 'BAHAN', satuanDasar: 'ML', dapatDijual: false, stokMinimum: 1000, satuanBeli: [['LITER', 1000]] },
  { kode: 'BHN-MEN', nama: 'Saus Mentai', jenis: 'BAHAN', satuanDasar: 'ML', dapatDijual: false, stokMinimum: 500, satuanBeli: [['LITER', 1000]] },

  // ── Kemasan ──
  { kode: 'KEM-MIK', nama: 'Mika / Sterofoam', jenis: 'KEMASAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['PACK', 50], ['DUS', 500]] },
  { kode: 'KEM-PLA', nama: 'Plastik Kresek', jenis: 'KEMASAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['PACK', 100]] },
  { kode: 'KEM-GEL', nama: 'Gelas Cup 22oz', jenis: 'KEMASAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['PACK', 50], ['DUS', 1000]] },
  { kode: 'KEM-SED', nama: 'Sedotan', jenis: 'KEMASAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['PACK', 100]] },
  { kode: 'KEM-TUS', nama: 'Tusuk Sate', jenis: 'KEMASAN', satuanDasar: 'PCS', dapatDijual: false, stokMinimum: 100, satuanBeli: [['PACK', 100]] },
];

/** Resep: kodeProdukJual → daftar [kodeBahan, jumlah, kodeSatuan] per 1 satuan dasar produk. */
const RESEP: Record<string, ReadonlyArray<[string, number, string]>> = {
  'DIM-ORI': [['BHN-DIM', 4, 'PCS'], ['KEM-MIK', 1, 'PCS'], ['KEM-PLA', 1, 'PCS'], ['BHN-SAU', 10, 'ML'], ['KEM-TUS', 1, 'PCS']],
  'DIM-MEN': [['BHN-DIM', 4, 'PCS'], ['BHN-MEN', 20, 'ML'], ['KEM-MIK', 1, 'PCS'], ['KEM-PLA', 1, 'PCS'], ['KEM-TUS', 1, 'PCS']],
  'DIM-BAK': [['BHN-DIM', 4, 'PCS'], ['BHN-SAU', 15, 'ML'], ['KEM-MIK', 1, 'PCS'], ['KEM-PLA', 1, 'PCS'], ['KEM-TUS', 2, 'PCS']],
  'DIM-MIN': [['BHN-DIM', 3, 'PCS'], ['BHN-SAU', 8, 'ML'], ['KEM-MIK', 1, 'PCS'], ['KEM-PLA', 1, 'PCS']],
  'DIM-BDY': [['BHN-DIM', 8, 'PCS'], ['BHN-MEN', 20, 'ML'], ['BHN-SAU', 20, 'ML'], ['KEM-MIK', 1, 'PCS'], ['KEM-PLA', 1, 'PCS'], ['KEM-TUS', 2, 'PCS']],
  'MIN-EST': [['BHN-TEH', 5, 'GRAM'], ['BHN-GUL', 30, 'ML'], ['BHN-ES', 150, 'GRAM'], ['KEM-GEL', 1, 'PCS'], ['KEM-SED', 1, 'PCS']],
};

const PENGATURAN: ReadonlyArray<[string, string]> = [
  ['nama_toko', 'Dimsum & Es Teh Nusantara'],
  ['alamat_toko', 'Jl. Merdeka No. 1, Jakarta'],
  ['telepon_toko', '0812-0000-0000'],
  ['pajak_persen', '0'],
  ['izinkan_stok_minus', 'true'],
  ['catatan_struk', 'Terima kasih atas kunjungan Anda!'],
];

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const klien = await pool.connect();
  try {
    await klien.query('BEGIN');
    await seedSatuan(klien);
    const idSatuan = await petaSatuan(klien);
    await seedHakAkses(klien);
    await seedPeranIzin(klien);
    await seedPengguna(klien);
    await seedBarang(klien, idSatuan);
    await seedResep(klien, idSatuan);
    await seedPemasok(klien);
    await seedPengaturan(klien);
    await klien.query('COMMIT');

    console.log('\n✓ Seed selesai.');
    console.log('  Akun pemilik : owner / owner123');
    console.log('  Akun kasir   : kasir / kasir123');
    console.log('  Ganti kata sandi setelah login pertama.\n');
  } catch (galat) {
    await klien.query('ROLLBACK');
    throw galat;
  } finally {
    klien.release();
    await pool.end();
  }
}

async function seedSatuan(k: PoolClient): Promise<void> {
  for (const [kode, nama] of SATUAN) {
    await k.query(
      `INSERT INTO satuan (kode_satuan, nama_satuan) VALUES ($1,$2)
       ON CONFLICT (kode_satuan) DO UPDATE SET nama_satuan = EXCLUDED.nama_satuan`,
      [kode, nama],
    );
  }
  console.log(`→ satuan: ${SATUAN.length}`);
}

async function petaSatuan(k: PoolClient): Promise<Map<string, string>> {
  const { rows } = await k.query<{ id_satuan: string; kode_satuan: string }>(
    'SELECT id_satuan::text, kode_satuan FROM satuan',
  );
  return new Map(rows.map((r) => [r.kode_satuan, r.id_satuan]));
}

async function seedPengguna(k: PoolClient): Promise<void> {
  const akun: ReadonlyArray<[string, string, string, string]> = [
    ['Pemilik Toko', 'owner', 'owner123', 'OWNER'],
    ['Kasir Toko', 'kasir', 'kasir123', 'KASIR'],
  ];
  for (const [nama, username, sandi, peran] of akun) {
    const hash = await bcrypt.hash(sandi, 10);
    await k.query(
      `INSERT INTO pengguna (nama_pengguna, username, kata_sandi_hash)
       VALUES ($1,$2,$3) ON CONFLICT (username) DO NOTHING`,
      [nama, username, hash],
    );
    await k.query(
      `INSERT INTO pengguna_peran (id_pengguna, id_peran)
       SELECT u.id_pengguna, p.id_peran FROM pengguna u, peran p
        WHERE u.username = $1 AND p.nama_peran = $2
       ON CONFLICT DO NOTHING`,
      [username, peran],
    );
  }
  console.log('→ pengguna: owner, kasir');
}

async function seedBarang(k: PoolClient, idSatuan: Map<string, string>): Promise<void> {
  for (const b of BARANG) {
    const idDasar = wajib(idSatuan, b.satuanDasar);
    const { rows } = await k.query<{ id_barang: string }>(
      `INSERT INTO barang (kode_barang, nama_barang, jenis_barang, id_satuan_dasar,
                           dapat_dijual, dapat_dibeli, stok_minimum, emoji, warna_kartu)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (kode_barang) DO UPDATE
         SET nama_barang = EXCLUDED.nama_barang, emoji = EXCLUDED.emoji,
             warna_kartu = EXCLUDED.warna_kartu, stok_minimum = EXCLUDED.stok_minimum
       RETURNING id_barang::text`,
      [b.kode, b.nama, b.jenis, idDasar, b.dapatDijual, !b.dapatDijual,
       b.stokMinimum ?? 0, b.emoji ?? null, b.warna ?? null],
    );
    const idBarang = rows[0]!.id_barang;

    // Req 3.3 — satuan dasar otomatis, konversi 1, default.
    await k.query(
      `INSERT INTO satuan_barang
         (id_barang, id_satuan, konversi_ke_satuan_dasar, harga_jual, adalah_satuan_default)
       VALUES ($1,$2,1,$3,TRUE)
       ON CONFLICT (id_barang, id_satuan) DO UPDATE SET harga_jual = EXCLUDED.harga_jual`,
      [idBarang, idDasar, b.hargaJual ?? 0],
    );

    for (const [kodeSatuan, isi] of b.satuanBeli ?? []) {
      await k.query(
        `INSERT INTO satuan_barang
           (id_barang, id_satuan, konversi_ke_satuan_dasar, harga_jual, adalah_satuan_default)
         VALUES ($1,$2,$3,0,FALSE)
         ON CONFLICT (id_barang, id_satuan) DO UPDATE
           SET konversi_ke_satuan_dasar = EXCLUDED.konversi_ke_satuan_dasar`,
        [idBarang, wajib(idSatuan, kodeSatuan), isi],
      );
    }
  }
  console.log(`→ barang: ${BARANG.length} (${BARANG.filter((b) => b.dapatDijual).length} dapat dijual)`);
}

async function seedResep(k: PoolClient, idSatuan: Map<string, string>): Promise<void> {
  for (const [kodeProduk, bahan] of Object.entries(RESEP)) {
    const { rows: adaResep } = await k.query<{ id_resep: string }>(
      `SELECT r.id_resep::text FROM resep r
         JOIN barang b ON b.id_barang = r.id_barang_hasil
        WHERE b.kode_barang = $1 AND r.status_aktif`,
      [kodeProduk],
    );
    if (adaResep.length > 0) continue; // jangan timpa resep yang sudah disunting pemilik

    const nama = BARANG.find((b) => b.kode === kodeProduk)?.nama ?? kodeProduk;
    const { rows } = await k.query<{ id_resep: string }>(
      `INSERT INTO resep (id_barang_hasil, nama_resep, versi_resep, status_aktif)
       SELECT id_barang, $2, 1, TRUE FROM barang WHERE kode_barang = $1
       RETURNING id_resep::text`,
      [kodeProduk, `Resep ${nama}`],
    );
    const idResep = rows[0]!.id_resep;

    for (const [kodeBahan, jumlah, kodeSatuan] of bahan) {
      await k.query(
        `INSERT INTO detail_resep (id_resep, id_barang_bahan, id_satuan, jumlah)
         SELECT $1, id_barang, $3, $4 FROM barang WHERE kode_barang = $2`,
        [idResep, kodeBahan, wajib(idSatuan, kodeSatuan), jumlah],
      );
    }
  }
  console.log(`→ resep: ${Object.keys(RESEP).length}`);
}

async function seedPemasok(k: PoolClient): Promise<void> {
  const pemasok: ReadonlyArray<[string, string, string]> = [
    ['SUP-001', 'Toko Frozen Jaya', '0812-1111-2222'],
    ['SUP-002', 'Grosir Kemasan Murah', '0813-3333-4444'],
    ['SUP-003', 'Agen Sembako Berkah', '0821-5555-6666'],
  ];
  for (const [kode, nama, telepon] of pemasok) {
    await k.query(
      `INSERT INTO pemasok (kode_pemasok, nama_pemasok, nomor_telepon)
       VALUES ($1,$2,$3) ON CONFLICT (kode_pemasok) DO NOTHING`,
      [kode, nama, telepon],
    );
  }
  console.log(`→ pemasok: ${pemasok.length}`);
}

async function seedPengaturan(k: PoolClient): Promise<void> {
  for (const [kunci, nilai] of PENGATURAN) {
    await k.query(
      `INSERT INTO pengaturan (kunci, nilai) VALUES ($1,$2) ON CONFLICT (kunci) DO NOTHING`,
      [kunci, nilai],
    );
  }
  console.log(`→ pengaturan: ${PENGATURAN.length}`);
}

function wajib(peta: Map<string, string>, kunci: string): string {
  const nilai = peta.get(kunci);
  if (!nilai) throw new Error(`Satuan '${kunci}' belum ada di database.`);
  return nilai;
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
