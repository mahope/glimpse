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
- 🚨 Alerts & Notifications — Device-aware alert rules (LCP/INP/CLS thresholds, score drop) with email + in‑app badge

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
- Alerts: set RESEND_API_KEY, EMAIL_FROM, and optionally NEXT_PUBLIC_APP_URL for links.

2) DB and run
- npm run db:generate; npm run db:migrate
- npm run dev (and optionally npm run workers)

## API Reference (selected)

- GET /api/sites/[siteId]/perf — Latest PSI (mobile+desktop) with in-memory cache. ?refresh=1 bypasses cache.
- GET /api/sites/[siteId]/perf/daily?days=30&device=ALL|MOBILE|DESKTOP — Daily aggregates for charts. Returns [{ date, scoreAvg, lcp, inp, cls }].
- GET /api/sites/[siteId]/perf/latest?strategy=MOBILE — Latest snapshot per URL for a device.

## Alerts

- Metrics supported: LCP p75, INP p75, CLS p75, Performance score day‑over‑day drop.
- Default thresholds (recommended):
  - LCP p75: > 2500ms (mobile), > 2000ms (desktop)
  - INP p75: > 200ms
  - CLS p75: > 0.1
  - Score drop: > 10 points
- Rules are per‑site and per‑device (ALL | MOBILE | DESKTOP). Each rule stores recipients[] for emails.
- Persistence: AlertRule and AlertEvent tables with unique (siteId,metric,device,date) to dedupe same‑day events.
- Cron: POST /api/cron/alerts evaluates rules on the latest data (and previous day for score drop), creates events, debounces duplicates if another OPEN exists within 24h, and resolves when back to normal next day.
- Notifications:
  - Email via Resend with concise subject/body and dashboard link
  - In‑app: Performance page shows an Alerts badge when an OPEN event exists in the last 24h

## UI

- Performance page shows latest PSI cards, queue buttons, and a line chart with 30/90d range and device toggle. Displays an "Alerts" badge linking to the Alerts page when recent open alerts exist.
- Alerts page lists AlertEvents with date, metric, device, value, status.
- Settings → Alerts has interactive CRUD for AlertRules (create, edit inline, delete). Client-side validation and optimistic updates included. Empty state suggests recommended defaults.

### Seeding default rules

Seed recommended defaults for all active sites lacking rules:
- LCP MOBILE 2500
- LCP DESKTOP 2000
- INP ALL 200
- CLS ALL 0.1
- SCORE_DROP ALL 10

Run:
- npm run seed:alerts

You can customize per site by editing scripts/seed-alerts.ts or creating rules via the UI.

## Jobs

- Cron endpoints (Authorization: Bearer ${CRON_SECRET}):
  - POST /api/cron/sync-gsc
  - POST /api/cron/performance-test
  - POST /api/cron/calculate-scores
  - POST /api/cron/crawl-site
  - POST /api/cron/alerts
- Manual triggers (org-scoped): POST /api/sites/[siteId]/jobs — body: { kind, params }

## Notes on PSI consolidation

See docs/IMPLEMENTATION-STATUS.md for current implementation coverage and next steps. Legacy seo-tracker dir is deprecated; glimpse is the canonical repo.

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

