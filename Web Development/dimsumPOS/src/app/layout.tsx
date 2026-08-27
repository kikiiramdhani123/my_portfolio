import type { Metadata, Viewport } from 'next';
import { DaftarSW } from '@/components/ui/DaftarSW';
import './globals.css';

export const metadata: Metadata = {
  title: 'POS Dimsum & Es Teh',
  description: 'Aplikasi kasir dan pengelolaan stok untuk usaha dimsum dan es teh.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'POS Dimsum', statusBarStyle: 'default' },
  icons: { icon: '/ikon-192.png', apple: '/ikon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfaf6' },
    { media: '(prefers-color-scheme: dark)', color: '#241f1c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
        <DaftarSW />
      </body>
    </html>
  );
}
