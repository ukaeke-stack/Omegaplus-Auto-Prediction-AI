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

The inherited daily-rollover route still assumes a fixed set of 15 Daily Best selections and is separate from the new social-publishing workflow. The social publisher only posts when the Daily Best builder returns qualifying selections; it does not fill an empty or shortfall set with unrelated fixtures. Review the legacy rollover route separately before scheduling it.

## Voice/text booking assistant

The home command bar and the Voice & Text Assistant page accept natural-language football requests. For example: “Give me a SportyBet booking code for 35 football games of Over 2.5 goals from today, tomorrow and the day after tomorrow.” The server resolves Lagos-local dates, checks active matching SportyBet markets, ranks available outcomes by the bookmaker market-probability signal, and returns only distinct matching fixtures. It never fills a requested count with unrelated markets. The user reviews the list and explicitly requests code generation; the booking service rechecks the current fixture market before attempting to create the SportyBet code.

Current assistant support is intentionally narrow: football, SportyBet, goals Over/Under lines 0.5/1.5/2.5/3.5/4.5, and date phrases for today/tomorrow/day after tomorrow. Actual code generation remains subject to the existing paid-access and admin booking-code settings, SportyBet availability, and its API response. Browser voice recognition requires a supported browser and microphone permission. A PNG slip image can be saved from the reviewed selections, with the booking code included after successful generation.

## Automated social publishing

The protected publishing endpoint posts the current date's Daily Best selections to a Facebook Page and/or X. It records one result per platform and date in the app's own PostgreSQL database to avoid duplicate successful posts. Failed posts can be retried; already-published dates are skipped. If there are no qualifying selections, nothing is posted.

Configure these Render environment variables only on the Auto Prediction AI service:

- `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN` — a Page token with the required publishing permissions.
- `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_TOKEN_SECRET` — X OAuth 1.0a user-context credentials with write permission.
- `CRON_SECRET` — a long, unique random secret protecting the automation endpoint.
- `SOCIAL_PUBLISHING_ENABLED` — keep `false` until you are ready to publish; set to `true` to enable scheduled and manual posting.
- `APP_BASE_URL` — the public URL of the Auto Prediction AI service.

Also add `APP_BASE_URL` and `CRON_SECRET` as GitHub Actions repository secrets. The workflow in `.github/workflows/social-publishing.yml` triggers the protected endpoint daily at 23:00 UTC (00:00 midnight in Nigeria, Africa/Lagos time) so the app can build/check that day's Daily Best selections and publish them. GitHub Actions schedules can be delayed, so this is a daily automation rather than an exact-time guarantee. If no quality-qualified selections are available at the time of the run, the endpoint skips posting; an administrator can trigger a post manually via the authenticated admin endpoint and inspect configuration/recent outcomes through the admin status endpoint.

Publishing is text-only in this initial version. Social credentials must never be committed to GitHub, placed in the client app, or copied from Omegaplus Pro AI. Test with credentials and accounts owned or authorized by the app owner before enabling the schedule.

## Starting point

The app was imported from commit `9b88b9b2466185f987c84d9b999237dbd90d9145` of the original project. Future changes in this repository must not modify the original Omegaplus Pro AI repository or its production database.
