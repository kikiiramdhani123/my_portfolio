import { muatEnv } from './env';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';

muatEnv();

/**
 * Kosongkan skema publik lalu bangun ulang dengan MODE KOSONG (tanpa data contoh).
 * HANYA untuk pengembangan / mulai ulang bisnis dari nol.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset:kosong dilarang di lingkungan produksi.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('→ skema public dikosongkan');
  } finally {
    await pool.end();
  }

  const hasilMigrasi = spawnSync('npm', ['run', 'db:migrate'], { stdio: 'inherit', shell: true });
  if (hasilMigrasi.status !== 0) process.exit(hasilMigrasi.status ?? 1);

  const hasilSeed = spawnSync('npm', ['run', 'db:seed:kosong'], { stdio: 'inherit', shell: true });
  if (hasilSeed.status !== 0) process.exit(hasilSeed.status ?? 1);
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
