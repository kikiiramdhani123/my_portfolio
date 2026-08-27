import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Muat variabel lingkungan: .env.local diutamakan, lalu .env sebagai cadangan. */
export function muatEnv(): void {
  for (const berkas of ['.env.local', '.env']) {
    const jalur = join(process.cwd(), berkas);
    if (existsSync(jalur)) config({ path: jalur, quiet: true });
  }
}
