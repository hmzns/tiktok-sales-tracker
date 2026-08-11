# Database Backup and Recovery

Use this guide before releases and whenever production data may be at risk. Test the process with a non-production database first.

## What must be protected

The PostgreSQL backup must preserve:

- `Product` and `ProductCategory`
- `SalesOrder` and `OrderItem`
- `Expense`
- `StockMovement`
- `TikTokConnection` encrypted-token and shop metadata
- `TikTokOAuthState` records where applicable
- `TikTokSyncRun` history
- TikTok payment mode, Finance status, settlement components, and sync timestamps on orders
- Prisma migration history in `_prisma_migrations`

Back up deployment configuration separately. Database exports must never contain plaintext environment variables, TikTok app secrets, the token-encryption key, API keys, or unrelated credentials. The encryption key is not stored in the database; without the original key, restored TikTok tokens cannot be decrypted and the shop must be reauthorized.

## Supabase-managed backups

Open the Supabase Dashboard and check **Database > Backups** for the backup and restore options available to the project's current plan. Availability, restore windows, downloadable formats, and point-in-time recovery depend on the plan and enabled options, so confirm them in the dashboard rather than assuming a retention period.

Supabase notes that managed database backups cover the database, while Storage objects are separate. This application does not currently depend on Supabase Storage for its business records. See [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

Before a release:

1. Confirm the latest usable managed backup or recovery point.
2. Record the backup time and the production Git commit.
3. If the plan does not provide the needed recovery coverage, create a manual logical export.
4. Keep the export encrypted in approved off-site storage and test that it is readable.

## Manual logical export

Supabase supports logical exports through its CLI, and its documentation also describes `pg_dump` options. Prefer the Supabase CLI flow because it applies Supabase-aware filtering. Follow the current [Supabase CLI backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Example placeholders only:

```bash
supabase db dump --db-url "<DATABASE_CONNECTION_STRING>" -f roles.sql --role-only
supabase db dump --db-url "<DATABASE_CONNECTION_STRING>" -f schema.sql
supabase db dump --db-url "<DATABASE_CONNECTION_STRING>" -f data.sql --use-copy --data-only
```

Do not paste a real connection string into shell history, documentation, issue trackers, or chat. Use a secure secret-input method appropriate to the operator's system. Restrict backup file permissions and remove local copies only after confirming the approved encrypted copy exists.

## Recovery preparation

Before restoring:

1. Stop or restrict writes so new orders and stock movements do not conflict with the restore.
2. Identify the incident time and the closest safe backup before it.
3. Record the currently deployed backend version and migration state.
4. Confirm that backend code, database snapshot, and Prisma migrations are compatible.
5. Plan for downtime; a managed restore can make the project unavailable.

Do not run `prisma migrate reset`, edit old migration files, or perform an untested destructive backfill.

## Recovery order

1. Restore the database using the Supabase Dashboard or the tested logical-restore procedure.
2. Deploy the backend version compatible with that database snapshot.
3. Restore Render and Cloudflare environment configuration from the separate secure record.
4. Run `npx prisma migrate deploy` if the restored database is behind the deployed version.
5. Verify public `GET /health`.
6. Verify Products, current stock, and a sample of historical product prices/costs.
7. Verify Orders, OrderItems, statuses, discounts, and stock movement references.
8. Verify TikTok connection status. Reauthorize if encrypted tokens cannot be decrypted or are expired.
9. Run one narrow TikTok order sync and confirm existing orders are not duplicated.
10. Verify Dashboard and Reports against known totals.

Also verify Expenses, one pending Finance order, one settled Finance order, and the latest sync-history entry before reopening normal writes.

## Recovery acceptance checks

- Product stock agrees with recent stock movements.
- `tiktokOrderId` uniqueness is intact.
- Completed orders still contain their historical item price and cost snapshots.
- FULL_TIKTOK pending profit is not displayed as RM0.
- Settled Finance uses settlement exactly once.
- Payment-mode switching does not change stock or item count.
- The Cloudflare Access policy and backend CORS origin are correct.
- No backup or restore log contains credentials, tokens, signed TikTok URLs, or raw customer data.
