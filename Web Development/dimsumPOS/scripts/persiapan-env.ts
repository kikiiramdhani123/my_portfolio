import { muatEnv } from './env';

// Diimpor paling pertama oleh skrip satu-kali di scripts/satu-kali/*,
// agar DATABASE_URL sudah terisi sebelum lib/db membuat connection pool.
muatEnv();
