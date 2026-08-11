# Admin and Maintenance Guide

## Architecture

```text
Cloudflare Pages + Cloudflare Access
  -> Render Express API
  -> Supabase PostgreSQL
  -> TikTok Shop Orders API / TikTok Finance API
```

Cloudflare Pages hosts the static Expo web export. Render runs the API and Prisma Client. Supabase stores business records, encrypted TikTok tokens, OAuth state, and sync history.

## Local development

Backend:

```bash
cd backend
npm ci
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Frontend in another terminal:

```bash
cd mobile
npm ci
cp .env.example .env
npm run web
```

Use `npx prisma migrate dev --name <short_description>` only for local schema development. Review the generated SQL before committing it. Never use `prisma migrate reset` on production.

## Build and database commands

```bash
cd backend
npx prisma validate
npx prisma generate
npm run build
npm test
npx prisma studio
```

Prisma Studio should point only to a local or deliberately selected database. Close it after use.

For production migrations:

```bash
cd backend
npm run migrate:deploy
```

`prisma migrate deploy` applies committed, unapplied migrations without creating new migrations or resetting data.

Frontend checks:

```bash
cd mobile
npx tsc --noEmit
npm test
npm run lint
npm run web:export
```

## Required environment variables

Backend core:

- `DATABASE_URL`
- `APP_API_KEY`
- `ALLOWED_ORIGINS` in production

Backend TikTok:

- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `TIKTOK_SHOP_AUTHORIZATION_URL`
- `TIKTOK_TOKEN_ENCRYPTION_KEY`

Frontend public:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_BACKEND_API_KEY`

Optional variables and endpoint defaults are documented in [`../backend/.env.example`](../backend/.env.example). Set `NODE_ENV=production` and `TZ=Asia/Kuching` on Render. All `EXPO_PUBLIC_*` values are browser-visible; never put TikTok secrets, database credentials, tokens, or encryption keys there.

## Render deployment

Use `backend` as the service root.

```text
Build command:      npm ci && npm run build
Pre-deploy command: npm run migrate:deploy
Start command:      npm start
Health path:        /health
```

Render documents pre-deploy commands as the stage for database migrations. If the current service plan does not offer that stage, run `npm run migrate:deploy` as a controlled release step before promoting the build. Do not append migration commands to a recurring application request or create keep-alive traffic. See [Render's deploy pipeline](https://render.com/docs/deploys).

After deployment, check `/health`, then call one protected read endpoint with `x-api-key`.

## Cloudflare Pages deployment

Use `mobile` as the Pages root.

```text
Build command: npm ci && npm run web:export
Output folder: dist
```

Set both frontend public variables for Production and Preview as appropriate. Add the exact Pages/custom-domain origins to backend `ALLOWED_ORIGINS`, without trailing slashes. Confirm the Cloudflare Access application and allowed-user policy still cover the production hostname. Cloudflare Pages can deploy from a connected Git provider or a prebuilt upload; see the [Cloudflare Pages overview](https://developers.cloudflare.com/pages/).

## TikTok authorization and reauthorization

The callback `GET /tiktok-shop/callback` must remain publicly reachable because TikTok redirects the browser to it. Starting authorization, reading status, refreshing, syncing shop metadata, orders, Finance, and history remain protected by `x-api-key`.

To authorize or reauthorize:

1. Confirm the TikTok app settings and backend environment variables.
2. Send protected `POST /tiktok-shop/connect` and open its returned authorization URL in a browser.
3. Complete the seller authorization.
4. Send protected `POST /tiktok-shop/shop/sync`.
5. Check protected `GET /tiktok-shop/status` shows exactly one connected and configured shop.

Reauthorization is required when the refresh token expires, credentials are revoked, or the token-encryption key was lost or changed. Do not log or paste token responses into tickets or documentation.

## Testing TikTok order sync

1. Back up the database or use a non-production shop for broad testing.
2. Confirm connection and shop status.
3. Use the Orders screen **Sync TikTok Orders** button, or protected `POST /tiktok-shop/orders/sync` with `{"days": 1}`.
4. Verify the summary and protected `GET /tiktok-shop/sync-history`.
5. Confirm a new import is **Needs Items**, has no order items, and has not deducted stock.
6. Repeat the sync and confirm the same TikTok order is counted as existing, not recreated.

The standalone `npm run sync:tiktok-orders` command performs one sync and exits. Scheduling is external to the application.

## Testing TikTok Finance

1. Use a completed TikTok order with a known payment mode.
2. Record current stock, items, discount, saved costs, and Finance fields.
3. Select **Sync TikTok Finance** or call protected `POST /orders/:id/sync-tiktok-finance`.
4. For an unsettled order, confirm FULL_TIKTOK profit remains unknown and status is Pending.
5. For a settled order, compare the stored settlement to TikTok's statement.
6. Confirm settlement is included once and breakdown fields are not deducted again.
7. Confirm stock, items, quantities, discounts, and historical costs did not change.

## Branch and release workflow

1. Create feature branches from the intended release base.
2. Review and test changes before merging into `release/v1.0.0`.
3. Keep schema changes in sequential committed migrations.
4. Complete [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).
5. Back up production, deploy migrations/API/frontend, and run production smoke tests.
6. After explicit release approval, merge to the main release branch as required by the repository workflow.
7. Create an annotated tag only after the deployed commit is confirmed:

   ```bash
   git tag -a v1.0.0 -m "TikTok Sales Tracker v1.0.0"
   git push origin v1.0.0
   ```

Do not create or push a release tag during an unapproved preparation pass.
