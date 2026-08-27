import { muatEnv } from './env';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { seedHakAkses, seedPeranIzin } from './seed-bersama';

muatEnv();

/**
 * Seed MODE KOSONG — hanya data pondasi wajib (peran, hak akses, matriks izin)
 * ditambah SATU akun OWNER pembuka. Tidak ada satuan, barang, resep, pemasok,
 * atau pengaturan bawaan — semua dibangun sendiri lewat Back Office.
 *
 * Kredensial OWNER diambil dari environment variable agar tidak ter-hardcode
 * di kode sumber:
 *   OWNER_NAMA, OWNER_USERNAME, OWNER_SANDI
 */
async function main(): Promise<void> {
  const nama = wajibEnv('OWNER_NAMA');
  const username = wajibEnv('OWNER_USERNAME');
  const sandi = wajibEnv('OWNER_SANDI');
  if (sandi.length < 6) throw new Error('OWNER_SANDI minimal 6 karakter.');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const klien = await pool.connect();
  try {
    await klien.query('BEGIN');

    await seedHakAkses(klien);
    await seedPeranIzin(klien);

    const hash = await bcrypt.hash(sandi, 10);
    await klien.query(
      `INSERT INTO pengguna (nama_pengguna, username, kata_sandi_hash)
       VALUES ($1,$2,$3) ON CONFLICT (username) DO NOTHING`,
      [nama, username, hash],
    );
    await klien.query(
      `INSERT INTO pengguna_peran (id_pengguna, id_peran)
       SELECT u.id_pengguna, p.id_peran FROM pengguna u, peran p
        WHERE u.username = $1 AND p.nama_peran = 'OWNER'
       ON CONFLICT DO NOTHING`,
      [username],
    );
    console.log(`→ pengguna: ${username} (OWNER)`);

    await klien.query('COMMIT');

    console.log('\n✓ Seed kosong selesai — tidak ada satuan/barang/resep/pemasok bawaan.');
    console.log(`  Akun pemilik : ${username} / (sandi sesuai OWNER_SANDI)`);
    console.log('  Langkah selanjutnya: Back Office → Satuan → Barang → Resep.\n');
  } catch (galat) {
    await klien.query('ROLLBACK');
    throw galat;
  } finally {
    klien.release();
    await pool.end();
  }
}

function wajibEnv(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Variabel lingkungan ${nama} belum diatur.`);
  return nilai;
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
