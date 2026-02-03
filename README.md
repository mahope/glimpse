# Glimpse

A comprehensive SEO dashboard for tracking WordPress site performance via Google Search Console and PageSpeed Insights.

## Features

- 📊 **Dashboard Analytics** - KPI cards, trending charts, top keywords & pages
- 🔍 **Google Search Console Integration** - Automated data sync for clicks, impressions, CTR, and positions
- ⚡ **Performance Monitoring** - Core Web Vitals tracking via PageSpeed Insights API (daily via BullMQ)
- 🏢 **Multi-tenant** - Organization-based site management via Better Auth
- 📧 **Magic Link Authentication** - Passwordless login with email
- 🎯 **SEO Scoring** - Calculated scores based on multiple performance factors
- 📈 **Historical Data** - Long-term tracking and trend analysis

## Tech Stack

- **Framework**: Next.js 16.1+ with App Router, Turbopack
- **Auth**: Better Auth 1.x with magic link & organization plugins
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Tailwind CSS 4.0+ with shadcn/ui components
- **Charts**: Recharts for data visualization
- **API Integration**: Google Search Console & PageSpeed Insights
- **Jobs**: Redis + BullMQ workers (safe no-op when Redis missing)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis (optional, for background jobs)
- Google OAuth credentials
- Resend account (for magic link emails)

### 1. Clone and Install

```bash
git clone <repository-url>
cd glimpse
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your configuration:

PageSpeed Insights configuration:
- Set PAGESPEED_API_KEY or GOOGLE_PSI_API_KEY. If neither is set, set MOCK_PSI="true" to use demo data.
- Dashboard shows mobile and desktop cards on Sites → Performance.

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/glimpse"

# Better Auth
BETTER_AUTH_SECRET="your-32-character-secret-key-here"

# Google OAuth (for Search Console access)
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Email (Resend for magic links)
RESEND_API_KEY="re_your-resend-api-key"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cron secret (protects /api/cron/* and /api/jobs/* routes)
CRON_SECRET="choose-a-strong-random-token"

# Redis (optional). If missing, workers no-op safely.
REDIS_URL="redis://localhost:6379"

# GSC mock mode (seed mock rows when creds missing)
MOCK_GSC="true"

# PSI
PAGESPEED_API_KEY="your-pagespeed-api-key" # or GOOGLE_PAGESPEED_API_KEY, or set MOCK_PSI=true
MOCK_PSI="false"
```

Also see `.env.example` for SERVICE_ACCOUNT_JSON (if using service accounts) and more.

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations (recommended)
npm run db:migrate

# Open Prisma Studio (optional)
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to access the dashboard.

### 5. Start Workers (optional)

```bash
npm run workers
```

- Starts BullMQ workers. If `REDIS_URL` is not set, workers print a warning and exit safely.
- Workers auto-load: gsc-sync, performance-test, score-calc, crawl-site
- Queues:
  - gsc:fetch — ingest GSC daily rows via fetchAndStoreGSCDaily
  - gsc-sync — GSC daily sync (02:00)
  - performance-test — PSI tests, MOBILE+DESKTOP (04:00)
  - site-crawl — weekly crawl (Sun 05:00)
  - score-calculation — SEO score recompute (06:00)

### Background jobs

- Cron endpoints (Authorization: Bearer ${CRON_SECRET}):
  - POST /api/cron/sync-gsc
  - POST /api/cron/performance-test
  - POST /api/cron/calculate-scores
  - POST /api/cron/crawl-site

- Manual triggers (org-scoped):
  - POST /api/sites/[siteId]/jobs — body: { kind, params }

### Performance History

- GET `/api/sites/[siteId]/perf` — Latest PSI (mobile+desktop) with in-memory cache. `?refresh=1` bypasses cache.
- GET `/api/sites/[siteId]/perf/daily?days=30` — Daily aggregates used by the Performance page history widget.
- GET `/api/sites/[siteId]/perf/latest?strategy=MOBILE` — Latest snapshot per URL for a device.

### UI Actions (Performance page)

- Queue PSI test (Mobile/Desktop): POST `/api/sites/[siteId]/jobs` body `{ "kind": "performance-test", "params": { "device": "MOBILE" | "DESKTOP" } }`
- Recalculate SEO score: POST `/api/sites/[siteId]/jobs` body `{ "kind": "score-calculation" }`

All routes require an authenticated session and are organization-scoped unless noted.

## Worker Details

- Queue name: `gsc:fetch`
- Backoff: exponential, attempts=3; limiter: max 5 req/sec
- Processor: calls fetchAndStoreGSCDaily over N recent days per site
- Scheduler: QueueScheduler initialized for delayed/retried jobs
- Safe mode: if Redis is missing, queue and worker stay disabled with console warnings

## Development

- UI for Keywords and Pages now supports server-side sorting via clickable headers with visual arrows; sort + direction sync to the URL and persist across pagination/filters.
- Performance page shows latest PSI (both devices), queue buttons, and a small history widget (30 days) derived from persisted snapshots and daily aggregates.
- Integration tests include org-boundary coverage for performance history and enqueue API.

## Troubleshooting

- If you don’t have Redis locally, workers will log "REDIS_URL not set. Worker disabled." and no-op.
- If you don’t have Google OAuth credentials, set `MOCK_GSC=true` to seed mock rows so the UI is usable.
- If you don’t have a PSI API key, set `MOCK_PSI=true` to render demo data.

## License

Private project for mahope.dk WordPress customers.
