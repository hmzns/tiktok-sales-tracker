# TikTok Sales Tracker

TikTok Sales Tracker is a single-seller inventory, order, expense, and profit tracker built for a small online shop. It combines manual sales with TikTok Shop order imports and settlement-aware accounting in a responsive Expo web application.

## Main features

- Product and category management with active/inactive states
- Stock adjustments, sale deductions, reversal movements, and movement history
- Manual multi-item orders with fixed or percentage discounts
- TikTok Shop OAuth, shop metadata, manual order synchronization, and sync history
- A Needs Items workflow for mapping imported orders to tracker products
- FULL_TIKTOK and EXTERNAL_PRODUCT_PAYMENT accounting modes
- TikTok Finance synchronization with pending and settled states
- Expenses, dashboard metrics, monthly overview, product performance, and sales trends
- CSV exports for products, expenses, orders, report summaries, product performance, and trends; JSON is available through the report APIs
- Responsive layouts for mobile browsers and desktop web

## Architecture

```text
Seller browser
  -> Cloudflare Access
  -> Cloudflare Pages (Expo static web app)
  -> Render (Express API)
  -> Supabase PostgreSQL
  -> TikTok Shop Order and Finance APIs
```

The frontend sends the project API credential in `x-api-key`. Cloudflare Access protects the deployed user interface, while the backend also enforces CORS, rate limiting, and API-key middleware. The TikTok OAuth callback and `/health` are the only intentionally public API routes.

## Technology

- Backend: Node.js, Express 5, TypeScript, Prisma, PostgreSQL, Zod
- Frontend: Expo 57, React Native, Expo Router, Expo Web, Axios, TypeScript
- Production: Cloudflare Pages, Cloudflare Access, Render, Supabase PostgreSQL
- Integration: TikTok Shop Orders API and TikTok Finance API

## TikTok payment scenarios

`FULL_TIKTOK` means the full order payment is handled by TikTok Shop. Tracker selling prices are retained as historical reference snapshots, but final recognized profit is:

```text
TikTok settlement - historical product cost
```

Until TikTok returns a settlement, Finance is Pending and profit is unknown—not RM0.

`EXTERNAL_PRODUCT_PAYMENT` means the product was paid outside TikTok, such as through WhatsApp, while a TikTok settlement can still apply. Final recognized profit is:

```text
tracker product revenue after discount
+ TikTok settlement
- historical product cost
```

TikTok settlement already includes TikTok shipping, fees, and taxes. Those components are stored for reference and are not deducted a second time.

## Screenshots

Screenshots are not yet committed. Add mobile and desktop captures here after the final production visual check.

## Local setup

Requirements: a supported Node.js release, npm, PostgreSQL access, and TikTok developer credentials only if testing the TikTok integration.

```bash
git clone <repository-url>
cd tiktok-sales-tracker

cd backend
npm ci
cp .env.example .env
npx prisma migrate dev
npm run dev
```

In a second terminal:

```bash
cd mobile
npm ci
cp .env.example .env
npm run web
```

For Expo Go, change `EXPO_PUBLIC_API_URL` from `localhost` to the development computer's LAN IP address.

## Environment setup

Backend variables are documented in [`backend/.env.example`](backend/.env.example). The core API requires `DATABASE_URL`, `APP_API_KEY`, and production `ALLOWED_ORIGINS`. TikTok features additionally require the app key, app secret, authorization URL, and a stable 32-byte token-encryption key.

Frontend public variables are documented in [`mobile/.env.example`](mobile/.env.example):

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_BACKEND_API_KEY`

All `EXPO_PUBLIC_*` values are embedded in the frontend bundle. Never put database credentials, TikTok secrets, tokens, or encryption keys there. The frontend API credential is intentionally public under this project's existing single-seller architecture and is not a replacement for Cloudflare Access.

## Build and test

Backend:

```bash
cd backend
npx prisma validate
npx prisma generate
npm run build
npm test --if-present
```

Frontend:

```bash
cd mobile
npx tsc --noEmit
npm test --if-present
npm run lint
npm run web:export
```

The static web output is written to `mobile/dist`.

## Deployment overview

1. Back up the production database and confirm environment variables.
2. Deploy the API to Render from `backend` using `npm ci && npm run build`, `npm run migrate:deploy`, and `npm start` in the appropriate deployment stages.
3. Verify public `/health`, protected API routes, and TikTok connectivity.
4. Deploy `mobile` to Cloudflare Pages using `npm ci && npm run web:export` with output directory `dist`.
5. Confirm Cloudflare Access policy, production CORS origin, and both public frontend variables.
6. Run the manual release checklist before creating the release tag.

Render free-service cold starts can delay the first request after inactivity. The application intentionally does not generate keep-alive traffic.

## Documentation

- [Seller user guide](docs/USER_GUIDE.md)
- [Admin and maintenance guide](docs/ADMIN_GUIDE.md)
- [Backup and recovery](docs/BACKUP_RECOVERY.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Backend API notes](backend/README.md)
- [Frontend notes](mobile/README.md)

## License

The frontend package retains its existing [MIT license](mobile/LICENSE). Review repository-wide licensing before distributing the complete project outside its current use.
