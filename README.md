# Glimpse

A comprehensive SEO dashboard for tracking WordPress site performance via Google Search Console and PageSpeed Insights.

## Features

- 📊 Dashboard Analytics — KPI cards, trending charts, top keywords & pages
- 🔍 Google Search Console Integration — Automated data sync for clicks, impressions, CTR, and positions
- ⚡ Performance Monitoring — Core Web Vitals tracking via PageSpeed Insights API (daily via BullMQ)
- 🏢 Multi-tenant — Organization-based site management via Better Auth
- 📧 Magic Link Authentication — Passwordless login with email
- 🎯 SEO Scoring — Calculated scores with component breakdown
- 📈 Historical Data — Long-term tracking and trend analysis

## Tech Stack

- Framework: Next.js 16.1+ with App Router, Turbopack
- Auth: Better Auth 1.x with magic link & organization plugins
- Database: PostgreSQL with Prisma ORM
- UI: Tailwind CSS 4.0+ with shadcn/ui components
- Charts: Recharts for data visualization
- API Integration: Google Search Console & PageSpeed Insights
- Jobs: Redis + BullMQ workers (safe no-op when Redis missing)

## Quick Start

1) Install and configure env
- Copy .env.example to .env
- PSI: set PAGESPEED_API_KEY or GOOGLE_PSI_API_KEY. If neither is set, set MOCK_PSI="true" to use demo data.
- GSC: set Google OAuth credentials or MOCK_GSC="true" for demo data.

2) DB and run
- npm run db:generate; npm run db:migrate
- npm run dev (and optionally npm run workers)

## API Reference (selected)

- GET /api/sites/[siteId]/perf — Latest PSI (mobile+desktop) with in-memory cache. ?refresh=1 bypasses cache.
- GET /api/sites/[siteId]/perf/daily?days=30&device=ALL|MOBILE|DESKTOP — Daily aggregates for charts. Returns [{ date, scoreAvg, lcp, inp, cls }].
- GET /api/sites/[siteId]/perf/latest?strategy=MOBILE — Latest snapshot per URL for a device.

## UI

- Performance page shows latest PSI cards, queue buttons, and a line chart with 30/90d range and device toggle.
- Queue buttons use headless toasts for success/error and disable while requests are in-flight.

## Jobs

- Cron endpoints (Authorization: Bearer ${CRON_SECRET}):
  - POST /api/cron/sync-gsc
  - POST /api/cron/performance-test
  - POST /api/cron/calculate-scores
  - POST /api/cron/crawl-site
- Manual triggers (org-scoped): POST /api/sites/[siteId]/jobs — body: { kind, params }

## Notes on PSI consolidation

- Canonical PSI module is under src/lib/perf/* (psi.ts and psi-service.ts).
- Jobs processors use runPsi from psi-service and persist PerfSnapshot, then upsert SitePerfDaily.
- Legacy src/lib/performance/* kept for thresholds; page-speed client replaced by perf/*.

### Per-device daily aggregates (2026-02-03)
- SitePerfDaily now has a device column (enum PerfDevice: ALL | MOBILE | DESKTOP). Existing rows are backfilled to ALL via migration.
- PSI processor writes PerfSnapshot.strategy per device and upserts SitePerfDaily by (siteId, date, device).
- GET /api/sites/[siteId]/perf/daily accepts ?device=ALL|MOBILE|DESKTOP and returns device-specific series.

## Troubleshooting

- Without Redis, workers will no-op safely.
- Without Google OAuth, set MOCK_GSC=true to seed mock rows so the UI is usable.
- Without a PSI API key, set MOCK_PSI=true to render demo data and keep tests offline.

Private project for mahope.dk WordPress customers.
