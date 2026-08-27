import { muatEnv } from '../scripts/env';

// Diimpor paling awal oleh berkas uji agar DATABASE_URL sudah terisi
// sebelum modul lib/db membuat connection pool.
muatEnv();
