import { muatEnv } from './env';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';

muatEnv();

/** Kosongkan skema publik lalu jalankan ulang migrasi + seed. HANYA untuk pengembangan. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset dilarang di lingkungan produksi.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('→ skema public dikosongkan');
  } finally {
    await pool.end();
  }

  for (const skrip of ['db:migrate', 'db:seed']) {
    const hasil = spawnSync('npm', ['run', skrip], { stdio: 'inherit', shell: true });
    if (hasil.status !== 0) process.exit(hasil.status ?? 1);
  }
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
