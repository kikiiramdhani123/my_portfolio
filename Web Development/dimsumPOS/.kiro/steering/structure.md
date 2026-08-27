# Structure Steering — POS Dimsum & Es Teh

```
dimsumPOS_APP/
├── .kiro/
│   ├── steering/                 # product.md, tech.md, structure.md (konteks permanen)
│   └── specs/pos-dimsum-esteh/   # requirements.md, design.md, tasks.md
├── db/
│   ├── migrations/               # 001_skema_inti.sql, 002_..., dijalankan berurutan
│   └── seed/                     # seed.sql / seed.ts data awal
├── scripts/                      # migrate.ts, seed.ts, reset.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # halaman login
│   │   ├── (kasir)/kasir/        # sisi penjualan — peran KASIR & OWNER
│   │   ├── (admin)/admin/        # sisi stocking — peran OWNER saja
│   │   └── api/                  # route handlers
│   ├── components/
│   │   ├── ui/                   # primitif: Button, Input, Modal, Table, Toast…
│   │   ├── kasir/                # ProductGrid, Cart, PaymentDialog, Receipt
│   │   └── admin/                # form & tabel back office
│   ├── lib/
│   │   ├── db.ts                 # pool pg + withTransaction()
│   │   ├── auth.ts               # sesi, hash, requireUser()
│   │   ├── rbac.ts               # requirePermission(), daftar hak akses
│   │   ├── money.ts              # aritmetika desimal aman
│   │   ├── stok.ts               # catatPergerakan(), saldo, weighted average
│   │   ├── hpp.ts                # hitung HPP produk (langsung / via resep)
│   │   └── validators/           # skema zod per domain
│   └── types/                    # tipe domain bersama
└── public/                       # ikon PWA, manifest, service worker
```

## Aturan Peletakan
- **Logika bisnis hanya di `src/lib/`.** Route handler tipis: validasi → panggil lib → format respons.
- **Komponen `src/components/ui/` tidak boleh tahu domain POS** (tanpa import dari `lib/stok` dll).
- **Query SQL tidak boleh ditulis di dalam komponen React.** Selalu lewat `src/lib/`.
- Setiap route `(admin)/**` diproteksi di layout **dan** di setiap API-nya (defense in depth).
