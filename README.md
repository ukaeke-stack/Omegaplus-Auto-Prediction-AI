# Omegaplus Auto Prediction AI

Independent deployment of the Omegaplus sports-prediction application. This repository is separate from **Omegaplus Pro AI**.

## Runtime

- Node.js 20 or later
- Express 5
- PostgreSQL (`pg`)
- Start command: `npm start` (runs `node server.js`)
- Health endpoint: `/health`
- Tests: `npm test`

## Offline-first storage

The browser/PWA uses IndexedDB on each device to cache successful responses from the app's public prediction, fixture, result, and history read APIs for up to 7 days. The service worker caches the application shell so the interface can reopen offline. Cached data is only a snapshot: live fixtures, scores, and newly generated analysis still require internet access.

The independent PostgreSQL database stores account data and a per-user offline-sync table. After login, the app synchronizes local settings and football/basketball slips across that user's devices. The sync API is authenticated and accepts only those record types; it does not sync passwords, session tokens, or admin data. Offline changes remain on the device until a connection and authenticated session are available.

This does not connect to or migrate any data from Omegaplus Pro AI. The local IndexedDB belongs to the user's browser/device, and the online database belongs only to this app.

## Render deployment preparation

1. Create a new Render Web Service from this repository, branch `main`.
2. Use Node as the runtime, `npm install` as the build command, and `npm start` as the start command.
3. Set the health-check path to `/health`.
4. Create a dedicated PostgreSQL database for this app and set `DATABASE_URL` to that database's internal connection string. Never use the original Omegaplus Pro AI database URL.

   **Temporary database warning:** the current Render Free database `omegaplus-auto-prediction-ai-db` is scheduled to expire on **13 November 2026**. Upgrade it or migrate its data to a durable database before expiry; the phone's local cache is not a replacement for a permanent server-side backup.
5. Configure the environment variables required by the app. Use a unique, strong admin password, and set `CRON_SECRET` and `APP_BASE_URL` before enabling scheduled jobs.
6. Keep API keys in Render's environment settings only. Do not commit real credentials or copy production secrets from the original app.

## Important before enabling automation

The imported code contains Vercel-specific archive-backup support and a Vercel cron configuration. PostgreSQL is the primary history store; Vercel Blob is optional. Render does not run `vercel.json` cron schedules, so scheduled tasks must be configured separately after the daily-rollover behavior has been reviewed and adapted.

The inherited daily-rollover route currently assumes a fixed set of 10 Daily Best selections. Review and update that behavior before enabling a scheduled rollover or social-media posting.

## Social publishing

Automated Facebook Page and X publishing is not configured in this starting commit. It should be added as a separate feature with credentials stored as Render secrets, explicit publishing controls, duplicate-post protection, and logging.

## Starting point

The app was imported from commit `9b88b9b2466185f987c84d9b999237dbd90d9145` of the original project. Future changes in this repository must not modify the original Omegaplus Pro AI repository or its production database.
