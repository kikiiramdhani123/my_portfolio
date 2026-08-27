'use client';

import { useEffect } from 'react';

/** Daftarkan service worker agar aplikasi dapat dipasang & shell tersedia offline (Req 10.1, 10.4). */
export function DaftarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
