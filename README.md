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
- Queues:
  - gsc:fetch — ingest GSC daily rows via fetchAndStoreGSCDaily

## API Routes

### GSC

- `POST /api/cron/gsc-refresh?siteId=&days=30` — Direct fetch from GSC and upsert SearchStatDaily (Authorization: Bearer ${CRON_SECRET})
- `POST /api/jobs/gsc-enqueue?days=30` — Enqueue gsc:fetch jobs for all active sites (Authorization: Bearer ${CRON_SECRET})
- `POST /api/jobs/register-on-boot` — Best-effort enqueue on app boot (Authorization: Bearer ${CRON_SECRET})

- `GET /api/sites/[siteId]/gsc/keywords?days=30&page=1&pageSize=50&device=all&country=all` — Aggregated keywords view
- `GET /api/sites/[siteId]/gsc/pages?days=30&page=1&pageSize=50` — Aggregated pages view

All routes require an authenticated session and are organization-scoped unless noted.

## Worker Details

- Queue name: `gsc:fetch`
- Backoff: exponential, attempts=3; limiter: max 5 req/sec
- Processor: calls fetchAndStoreGSCDaily over N recent days per site
- Scheduler: QueueScheduler initialized for delayed/retried jobs
- Safe mode: if Redis is missing, queue and worker stay disabled with console warnings

## Development

- UI for Keywords and Pages is wired to the aggregation routes with client-side filters, sorting, and pagination. Works with MOCK_GSC.
- Integration tests that touch DB are conditionally skipped if Postgres isn’t available.

## Troubleshooting

- If you don’t have Redis locally, workers will log "REDIS_URL not set. Worker disabled." and no-op.
- If you don’t have Google OAuth credentials, set `MOCK_GSC=true` to seed mock rows so the UI is usable.

## License

Private project for mahope.dk WordPress customers.
