# v1.0.0 Release Checklist

Run this checklist against the exact release commit. Do not use production for destructive tests.

## Backend

- [ ] `cd backend && npx prisma validate`
- [ ] `cd backend && npx prisma generate`
- [ ] `cd backend && npm run build`
- [ ] `cd backend && npm test --if-present`
- [ ] Confirm all committed migrations are sequential and reviewed
- [ ] Confirm `npx prisma migrate deploy` succeeds against a safe target
- [ ] `GET /health` returns 200 without an API key
- [ ] A protected route returns 401 without `x-api-key`
- [ ] A protected route succeeds with the production API key
- [ ] Review CORS, rate limiting, callback exposure, errors, and production logs
- [ ] Confirm logs contain no tokens, secrets, signed URLs, authorization headers, raw customer PII, or raw TikTok responses
- [ ] Run `npm audit --omit=dev`; confirm backend is clear and review unresolved Expo/Metro build-chain advisories without using a forced breaking downgrade

## Frontend

- [ ] `cd mobile && npx tsc --noEmit`
- [ ] `cd mobile && npm test --if-present`
- [ ] `cd mobile && npm run lint`
- [ ] `cd mobile && npm run web:export`
- [ ] Test at 375px width
- [ ] Test on a larger mobile viewport/device
- [ ] Test the desktop layout
- [ ] Confirm loading, error, retry, empty, and pull-to-refresh states
- [ ] Confirm production API URL and public credential are configured

## Core workflows

- [ ] Create, edit, search, activate, and deactivate Products
- [ ] Create/edit categories and confirm inactive-category behavior
- [ ] Restock, manual in, manual out, and damage stock adjustments
- [ ] Create a manual order with multiple items
- [ ] Test fixed and percentage discounts
- [ ] Confirm historical item prices and costs survive catalogue edits
- [ ] Sync TikTok orders
- [ ] Confirm repeated TikTok sync does not duplicate orders
- [ ] Complete a Needs Items order
- [ ] Complete a FULL_TIKTOK order and confirm stock deducts once
- [ ] Confirm FULL_TIKTOK pending Finance shows unknown profit, not RM0
- [ ] Sync a settled FULL_TIKTOK order and compare settlement minus historical COGS
- [ ] Complete an EXTERNAL_PRODUCT_PAYMENT order with a discount
- [ ] Sync its Finance and confirm tracker net revenue plus settlement minus historical COGS
- [ ] Switch FULL_TIKTOK to EXTERNAL_PRODUCT_PAYMENT and back
- [ ] Confirm payment-mode switching preserves stock, movements, items, snapshots, discounts, costs, and Finance fields
- [ ] Cancel an order and confirm one stock restoration
- [ ] Refund an order and confirm one stock restoration
- [ ] Add, edit, delete, search, and filter an Expense
- [ ] Verify Dashboard totals and pending-Finance count
- [ ] Verify Reports Overview
- [ ] Verify Product Performance and FULL_TIKTOK allocation notice
- [ ] Verify Sales Trends and date boundaries
- [ ] Export Products CSV
- [ ] Export Expenses CSV
- [ ] Export Overview, Orders, Product Performance, and Sales Trends CSV files
- [ ] Verify protected report JSON responses
- [ ] Verify TikTok Sync Status and history

## Production

- [ ] Confirm a usable Supabase backup or manual logical export
- [ ] Record the release commit and current database migration state
- [ ] Deploy the Render backend
- [ ] Run `prisma migrate deploy`
- [ ] Verify live `/health` and one protected read endpoint
- [ ] Deploy Cloudflare Pages output
- [ ] Confirm Cloudflare Access protects the production hostname
- [ ] Confirm backend `ALLOWED_ORIGINS` exactly lists production frontend origins
- [ ] Confirm no private secret was placed in an `EXPO_PUBLIC_*` variable
- [ ] Test one real TikTok order import without duplicating an existing order
- [ ] Compare one real settled TikTok Finance amount and calculated profit
- [ ] Verify backup/recovery documentation and secure environment records
- [ ] Review [Known Limitations](KNOWN_LIMITATIONS.md) with the owner
- [ ] Obtain release approval before creating or pushing `v1.0.0`
