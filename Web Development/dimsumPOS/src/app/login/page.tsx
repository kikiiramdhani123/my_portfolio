'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Galat, Isian, Tombol } from '@/components/ui/dasar';
import { api } from '@/lib/klien';

export default function HalamanLogin() {
  return (
    <Suspense fallback={null}>
      <FormLogin />
    </Suspense>
  );
}

function FormLogin() {
  const router = useRouter();
  const parameter = useSearchParams();
  const [username, setUsername] = useState('');
  const [kataSandi, setKataSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [memproses, setMemproses] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat('');
    setMemproses(true);
    try {
      const hasil = await api<{ beranda: string }>('/api/auth/login', {
        method: 'POST',
        json: { username, kataSandi },
      });
      const lanjut = parameter.get('lanjut');
      router.replace(lanjut && lanjut.startsWith('/') ? lanjut : hasil.beranda);
      router.refresh();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal masuk.');
      setMemproses(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-latar px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-aksen-lembut text-3xl">
            🥟
          </div>
          <h1 className="text-2xl font-bold">POS Dimsum &amp; Es Teh</h1>
          <p className="mt-1 text-sm text-teks-lembut">Masuk untuk mulai bekerja</p>
        </div>

        <form
          onSubmit={kirim}
          className="space-y-4 rounded-[var(--radius-kartu)] border border-garis bg-permukaan p-6 shadow-sm"
        >
          {galat && <Galat pesan={galat} />}

          <Isian
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
          <Isian
            label="Kata Sandi"
            type="password"
            value={kataSandi}
            onChange={(e) => setKataSandi(e.target.value)}
            autoComplete="current-password"
            required
          />

          <Tombol type="submit" varian="utama" className="w-full" disabled={memproses}>
            {memproses ? 'Memproses…' : 'Masuk'}
          </Tombol>
        </form>

        <p className="mt-6 text-center text-xs text-teks-lembut">
          Akun bawaan · pemilik <code className="font-semibold">owner / owner123</code> ·
          kasir <code className="font-semibold">kasir / kasir123</code>
        </p>
      </div>
    </main>
  );
}
