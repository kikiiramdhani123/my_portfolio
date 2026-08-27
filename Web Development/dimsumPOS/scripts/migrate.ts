import { muatEnv } from './env';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

muatEnv();

const DIR = join(process.cwd(), 'db', 'migrations');

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: wajibEnv('DATABASE_URL') });
  const klien = await pool.connect();
  try {
    await klien.query(`
      CREATE TABLE IF NOT EXISTS _migrasi (
        nama       VARCHAR(200) PRIMARY KEY,
        dijalankan TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const sudah = new Set(
      (await klien.query<{ nama: string }>('SELECT nama FROM _migrasi')).rows.map((r) => r.nama),
    );
    const berkas = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    let jumlah = 0;
    for (const nama of berkas) {
      if (sudah.has(nama)) continue;
      const sql = readFileSync(join(DIR, nama), 'utf8');
      process.stdout.write(`→ menjalankan ${nama} … `);
      await klien.query('BEGIN');
      try {
        await klien.query(sql);
        await klien.query('INSERT INTO _migrasi (nama) VALUES ($1)', [nama]);
        await klien.query('COMMIT');
        console.log('OK');
        jumlah += 1;
      } catch (galat) {
        await klien.query('ROLLBACK');
        console.log('GAGAL');
        throw galat;
      }
    }
    console.log(jumlah === 0 ? 'Tidak ada migrasi baru.' : `${jumlah} migrasi diterapkan.`);
  } finally {
    klien.release();
    await pool.end();
  }
}

function wajibEnv(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`${nama} belum diatur di .env.local`);
  return nilai;
}

main().catch((galat: unknown) => {
  console.error(galat);
  process.exit(1);
});
