/**
 * Konfigurasi pm2 — menjalankan POS Dimsum & Es Teh sebagai proses latar
 * yang otomatis pulih kalau crash, dan otomatis jalan lagi setelah laptop
 * di-restart (lihat README bagian "Menjalankan otomatis saat laptop menyala").
 */
module.exports = {
  apps: [
    {
      name: 'pos-dimsum',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      cwd: __dirname,
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
  ],
};
