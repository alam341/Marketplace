# MarketDash

Dashboard manajemen penjualan marketplace (Shopee, Lazada, TikTok Shop) dengan role-based access.

## Demo Login

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| SPV  | `spv`    | `password123` | Semua data tim |
| ADV  | `adv1`   | `password123` | Data pribadi (Budi Santoso) |
| ADV  | `adv2`   | `password123` | Data pribadi (Sari Dewi) |
| ADV  | `adv3`   | `password123` | Data pribadi (Ahmad Fauzi) |
| ADV  | `adv4`   | `password123` | Data pribadi (Rina Kusuma) |

## Fitur

- **Dashboard** — Stats cards, chart revenue bulanan, donut marketplace, leaderboard tim (SPV)
- **Report** — Tren revenue per marketplace, filter per ADV (SPV), export CSV
- **Product** — Daftar produk dengan filter kategori, chart distribusi stok
- **Transaction** — Riwayat transaksi, filter multi-dimensi, export CSV

## Deploy ke GitHub Pages

1. Push ke GitHub repository
2. Buka Settings → Pages → Source: `main` branch, folder `/`
3. Akses di `https://<username>.github.io/<repo-name>/`

## Struktur

```
marketplace-dashboard/
├── index.html          # Login
├── dashboard.html      # Dashboard utama
├── report.html         # Laporan revenue
├── product.html        # Manajemen produk
├── transaction.html    # Riwayat transaksi
├── css/main.css        # Semua style
└── js/
    ├── data.js         # Mock data & helpers
    ├── auth.js         # Login/logout/session
    └── app.js          # Sidebar, header, shared utils
```
