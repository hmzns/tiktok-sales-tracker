# Known Limitations

These are intentional v1.0.0 limitations confirmed in the current codebase.

- TikTok order synchronization is manual in the app. A one-shot backend command exists, but recurring synchronization requires a separately configured external scheduler.
- Render free-service cold starts can delay the first API request after inactivity. The project does not send fake keep-alive traffic.
- TikTok Finance can remain Pending until TikTok settles an order. FULL_TIKTOK profit is unknown during that period and is excluded from financial totals.
- Historical TikTok orders created before payment-mode and Finance support can require manual payment-mode confirmation. Legacy zero-price snapshots require explicit tracker price confirmation before switching to external product payment.
- FULL_TIKTOK settlement is stored at order level. It cannot always be allocated accurately to individual tracker products, so per-product financial metrics exclude those order-level amounts while still counting units.
- TikTok SKUs are not mapped automatically to tracker products. The seller must select products and quantities in the Needs Items workflow.
- The application uses a single shared backend API credential in the browser plus Cloudflare Access. It is designed for one protected seller deployment, not as a multi-tenant SaaS authentication or authorization system.
- The OAuth callback is intentionally public. Starting authorization and all operational TikTok endpoints remain API-key protected.
- CSV exports are web-only. The protected report APIs provide JSON data, but the mobile UI does not download export files on native platforms.
- Native App Store and Google Play distribution are not part of the current web release.
- The repository still uses floating-point columns for legacy tracker prices, costs, discounts, expenses, and totals. Money calculations are rounded through integer cents in order/accounting code, while TikTok Finance fields use PostgreSQL `Decimal(18,2)`.
- The dashboard and reports calculate over the selected date range at request time. Very large future datasets may require further aggregation or pagination work.
- The Orders screen currently loads all order pages for client-side date filtering and sorting, and several list screens render rows in a `ScrollView`. Very large datasets can therefore feel slower than the current single-seller workload.
- Browser access depends on Cloudflare Access configuration outside this repository. Backend CORS and the shared API key do not identify individual users.
