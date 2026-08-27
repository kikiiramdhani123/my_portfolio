import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// NUMERIC (OID 1700) dan INT8 (OID 20) dikembalikan sebagai string agar tidak
// kehilangan presisi. Semua aritmetika uang lewat lib/money.ts. (tech.md aturan 1)
types.setTypeParser(1700, (v) => v);
types.setTypeParser(20, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __posPool: Pool | undefined;
}

function buatPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL belum diatur. Salin .env.example menjadi .env.local.');
  }
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

// Next.js dev melakukan hot-reload; pool disimpan di globalThis agar tidak menumpuk.
export const pool: Pool = globalThis.__posPool ?? buatPool();
if (process.env.NODE_ENV !== 'production') globalThis.__posPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const hasil = await pool.query<T>(text, params as unknown[]);
  return hasil.rows;
}

export async function querySatu<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const baris = await query<T>(text, params);
  return baris[0] ?? null;
}

/** Jalankan `fn` di dalam satu transaksi database. Otomatis ROLLBACK bila melempar. */
export async function withTransaction<T>(fn: (klien: Klien) => Promise<T>): Promise<T> {
  const klien = await pool.connect();
  try {
    await klien.query('BEGIN');
    const hasil = await fn(bungkus(klien));
    await klien.query('COMMIT');
    return hasil;
  } catch (galat) {
    await klien.query('ROLLBACK').catch(() => undefined);
    throw galat;
  } finally {
    klien.release();
  }
}

export interface Klien {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  satu<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<T | null>;
}

function bungkus(klien: PoolClient): Klien {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<T[]> {
      const hasil = await klien.query<T>(text, params as unknown[]);
      return hasil.rows;
    },
    async satu<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<T | null> {
      const hasil = await klien.query<T>(text, params as unknown[]);
      return hasil.rows[0] ?? null;
    },
  };
}

/**
 * Klien non-transaksional yang memakai pool langsung.
 * Untuk pembacaan saja — jangan dipakai untuk operasi yang butuh atomisitas.
 */
export const klienPool: Klien = {
  query,
  satu: querySatu,
};

/** Kode galat unik PostgreSQL. */
export function adalahPelanggaranUnik(galat: unknown): galat is { code: '23505'; constraint?: string } {
  return typeof galat === 'object' && galat !== null && (galat as { code?: string }).code === '23505';
}
