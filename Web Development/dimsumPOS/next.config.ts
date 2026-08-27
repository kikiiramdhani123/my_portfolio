import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
