# TikTok Sales Tracker API

Express and Prisma API for the TikTok Sales Tracker v1.0.0 application.

## Development

```bash
npm ci
cp .env.example .env
npx prisma migrate dev
npm run dev
```

The default local URL is `http://localhost:3000`. `GET /health` is public. Every other route requires `x-api-key`, except the public TikTok OAuth callback at `GET /tiktok-shop/callback`.

## Commands

```bash
npx prisma validate          # validate the schema
npx prisma generate          # generate Prisma Client
npx prisma migrate dev       # create/apply local development migrations
npm run migrate:deploy       # apply committed migrations in production
npm run build                # generate Prisma Client and compile TypeScript
npm test                     # run backend regression tests
npm start                    # run compiled API
npm run sync:tiktok-orders   # run one standalone TikTok order sync
npx prisma studio            # inspect a local/development database
```

Do not run `prisma migrate reset` against production.

## Environment

See [`.env.example`](.env.example) for every variable read by the application. Core variables are `DATABASE_URL`, `APP_API_KEY`, and production `ALLOWED_ORIGINS`. TikTok integration also requires `TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET`, `TIKTOK_SHOP_AUTHORIZATION_URL`, and `TIKTOK_TOKEN_ENCRYPTION_KEY`.

Set `TZ=Asia/Kuching` so dashboard and report boundaries follow the business timezone. Keep the token-encryption key unchanged after authorization; changing it makes stored tokens unreadable and requires reauthorization.

## Main routes

- `/products` and `/product-categories`
- `/stock-movements`
- `/orders`, including import completion, payment-mode changes, and Finance sync
- `/expenses`
- `/dashboard/summary`
- `/reports/monthly` and `/reports/sales-trends`
- `/tiktok-shop/connect`, `/status`, `/refresh`, `/shop/sync`, `/orders/sync`, and `/sync-history`
- `/api-docs` for the complete machine-readable route list

Order and report responses omit `rawImportData`. TikTok tokens are encrypted using AES-256-GCM before storage, and API responses expose only safe connection metadata.

## TikTok accounting

- FULL_TIKTOK: settlement minus historical order-item COGS; pending settlement means null profit.
- EXTERNAL_PRODUCT_PAYMENT: tracker net product revenue plus settlement minus historical order-item COGS.
- Settlement breakdown fields are not added or deducted again.
- Payment-mode switching preserves stock, items, snapshots, discounts, and Finance aggregates.

## Production deployment

Use the `backend` directory as the Render service root.

```text
Build:       npm ci && npm run build
Migration:   npm run migrate:deploy
Start:       npm start
Health:      GET /health
```

If the selected Render plan does not provide a pre-deploy command, run the migration command as a deliberate release step before promoting the new API version. See [`../docs/ADMIN_GUIDE.md`](../docs/ADMIN_GUIDE.md).
