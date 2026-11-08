# Hosting

The API runs as one container (`Dockerfile`) with PostgreSQL 16 + PostGIS beside it. The plan is the home
simple-k8s instance (below); `render.yaml` is a hosted alternative. Any host that runs a
container and offers Postgres with PostGIS, pg_trgm and unaccent works the same way.

## Home: simple-k8s (the plan)

amexbutikker runs as one more app in the home simple-k8s instance next to the media services on
johann.no. One container serves both the web app (`/`) and the API (`/v1`) at `amex.johann.no`.

CI publishes the image on every push to main: `ghcr.io/vaarvik/amexbutikker:main` and `:sha-<commit>`,
for amd64 and arm64. GHCR packages start private: make it public, or give simple-k8s a pull secret.

| Setting in simple-k8s | Value                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| Image                 | `ghcr.io/vaarvik/amexbutikker:main` (or a `sha-…` tag to pin a release)       |
| Port                  | `3000`; health check `GET /health`                                            |
| URL                   | `amex.johann.no`                                                              |
| Command               | `sh -c "node dist/src/migrate.js && node dist/src/server.js"`                 |
| Database              | Postgres 16 with the PostGIS, pg_trgm and unaccent extensions available       |
| Environment           | `DATABASE_URL`, `DEVICE_TOKEN_SECRET` (secret, 32+ chars), `TRUST_PROXY=true` |
| Nightly job           | same image, `node dist/src/cli.js refresh-statuses`                           |
| Copies                | 1 (rate limits are per process)                                               |

Device attestation (Phase 16): without it, every answer counts as `unverified_report` (half a user
report) and wallet answers get no extra weight. Set these on the app:

| Setting                    | Value                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `APP_ATTEST_APP_IDS`       | `<Team ID>.<bundle id>`, e.g. `ABCDE12345.no.amexbutikker.app` (Apple Developer → Membership) |
| `APP_ATTEST_DEVELOPMENT`   | `true` only while testing development builds                                                  |
| `TURNSTILE_SECRET_KEY`     | the secret of a Turnstile widget for `amex.johann.no` (Cloudflare → Turnstile), a secret      |
| `TURNSTILE_HOSTNAMES`      | `amex.johann.no`                                                                              |
| `TRUST_UNATTESTED_DEVICES` | leave unset (false). `true` is for local development and the simulator only                   |

The web build needs the widget's public site key: `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (a build
argument of the image; CI passes the repository variable `TURNSTILE_SITE_KEY`). Cloudflare's test keys (`1x00000000000000000000AA` /
`1x0000000000000000000000000000000AA`) always pass; use them only locally.

`CORS_ORIGINS` stays empty: the web app and the API share the origin. The web app inside the image is
built with `EXPO_PUBLIC_API_URL=/`, so it calls the API on whatever host serves it.

## Elsewhere: Render

`render.yaml` is the same setup as a hosted alternative.

## What runs

| Piece                         | Command in the image                         | When                       |
| ----------------------------- | -------------------------------------------- | -------------------------- |
| API                           | `node dist/src/server.js`                    | always; health: `/health`  |
| Migrations                    | `node dist/src/migrate.js`                   | on every deploy, before it |
| Status refresh (decay)        | `node dist/src/cli.js refresh-statuses`      | nightly, 03:00 UTC         |
| Imports (OSM, Brreg, curated) | `pnpm run import <source>` from your machine | by hand, now and then      |

The image holds the API and the workspace packages it uses, built with `pnpm deploy`; the app is not in it.
CI builds the image and checks `/health` on every push (`image` job).

## Environment

| Variable              | Value                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | The database's connection string. Render fills it in.                                   |
| `DEVICE_TOKEN_SECRET` | At least 32 random characters. Render generates it. Changing it signs every device out. |
| `STORAGE`             | `postgres` (the image's default).                                                       |
| `TRUST_PROXY`         | `true` behind the host's proxy, so rate limits see the client's address.                |
| `CORS_ORIGINS`        | Exact origins of a hosted web app, comma-separated; empty while there is none.          |
| `PORT`, `HOST`        | Set by the host / the image.                                                            |

## First deploy on Render

1. Create a Render account and connect GitHub (you; Claude does not create accounts).
2. Dashboard → **New → Blueprint** → pick `vaarvik/amexbutikker.no`. Render reads `render.yaml` and
   creates the database, the API and the cron job. Plans in the file: `starter` services and a
   `basic-256mb` database; check the current prices before you confirm.
3. When the API is live, open `https://<service>.onrender.com/health`: it answers `{"status":"ok"}`.
4. Fill the database from your machine (next section).
5. Point the app at it: `EXPO_PUBLIC_API_URL=https://<service>.onrender.com` (see
   [testing-on-phones.md](testing-on-phones.md) for EAS builds).

## Filling the production database

The database only accepts Render's own services. To import from your machine:

1. Database → **Networking** → add your current IP address to the allow list.
2. Copy the **External Database URL** and run the imports against it:

   ```bash
   export DATABASE_URL='postgres://…frankfurt-postgres.render.com/amexbutikker?sslmode=require'
   pnpm run import osm_overpass
   pnpm run import brreg_underenheter
   pnpm run import curated_list
   pnpm refresh-statuses -- --older-than-hours 0
   ```

3. Remove your IP from the allow list again.

Never commit the external URL; it holds the database password.

## Later

- One instance is enough for now. Several need the rate limits in a shared store (`InMemoryRateLimiter`
  is per process).
- The API connects as the database owner. Migration m0005 creates the `amexbutikker_app` role, which may
  not change or delete evidence; switching the API to a login for that role is the next hardening step.
