# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glimpse is an internal SEO dashboard for mahope.dk's ~25 WordPress customers. It pulls data from Google Search Console, runs PageSpeed Insights tests, crawls sites for issues, and calculates composite SEO scores. Each customer (Organization) can have multiple sites.

## Commands

```bash
# Development
npm run dev              # Next.js dev server with Turbopack
npm run workers          # BullMQ worker process (requires Redis)
npm run dev:all          # Both dev server + workers concurrently

# Build & Run
npm run build            # Production build (standalone output)
npm run start            # Start production server

# Database
npm run db:migrate       # prisma migrate dev
npm run db:push          # prisma db push (no migration file)
npm run db:generate      # prisma generate
npm run db:studio        # Prisma Studio GUI
npm run db:seed          # Run prisma/seed.ts
npm run seed:alerts      # Seed default alert rules for all active sites

# Testing
npm run test             # vitest run (all tests in tests/)
npx vitest run tests/scoring.calculator.test.ts   # Single test file
npx vitest run tests/perf/                        # Test directory

# Lint
npm run lint             # next lint (ESLint 9)
```

## Tech Stack

Next.js 16.1+ (Turbopack, proxy.ts, `'use cache'`) | React 19 | Better Auth 1.x (magic link, organizations, Google OAuth) | PostgreSQL 17 via Prisma 6.2+ | Tailwind CSS 4.0 + shadcn/ui | Recharts | TanStack Query 5 | Redis + BullMQ | Resend (email) | Zod

## Architecture

### Multi-Tenancy Model

```
Organization (Better Auth plugin)
└── Site[] (1:N via organizationId)
    Each site has: GSC data, PSI snapshots, crawl reports, SEO scores, alert rules
```

Session carries `activeOrganizationId`. All site queries MUST filter by `organizationId` for tenant isolation.

### Auth (Better Auth)

- **Server config**: `src/lib/auth.ts` - Prisma adapter, magic link, organization, Google OAuth
- **Client config**: `src/lib/auth-client.ts` - `useSession()`, `signIn`, `signOut`, `organization`
- **API handler**: `src/app/api/auth/[...all]/route.ts`
- **Route protection**: `proxy.ts` at project root (Next.js 16 replacement for middleware.ts)
- **Server-side session**: `auth.api.getSession({ headers: await headers() })`
- **Client-side session**: `useSession()` hook

### Data Pipeline

**GSC Data:** `gsc-sync` queue → `gsc-sync-worker` → `fetchAndStoreGSCDaily()` → `SearchStatDaily` table. Used by overview, keywords, pages API routes and `SEOCalculator` scoring. Note: some legacy UI components still read from `SearchConsoleData` (reports, site-details) — these should be migrated to `SearchStatDaily`.

**PSI Performance:** `performance-test` queue → `perf-worker` → `psi-service.ts` → `PerfSnapshot` + `SitePerfDaily`. Used by perf API routes, scoring, and alerts. Note: the `PerformanceTest` model in the schema is legacy and unused by the canonical pipeline.

**Scoring:** `lib/scoring/calculator.ts` — 5 weighted components: click trend 25%, position trend 25%, impression trend 20%, CTR benchmark 15%, performance 15%.

### Background Jobs (BullMQ)

Workers run as a separate process (`npm run workers`). They no-op gracefully without Redis.

| Queue | Schedule | Concurrency | Rate Limit |
|-------|----------|-------------|------------|
| `gsc-sync` | 02:00 daily | 3 | 10/min |
| `performance-test` | 04:00 daily | 2 | 5/min |
| `site-crawl` | 05:00 Sundays | 1 | 2/5min |
| `score-calculation` | 06:00 daily | 5 | 20/min |

Key files: `src/lib/jobs/queue.ts` (queue definitions), `src/lib/jobs/workers/` (worker instances), `src/lib/jobs/processors/` (slim processor functions), `src/lib/jobs/register.ts` (repeatable job registration).

`server-init.ts` calls `/api/jobs/register-on-boot` on every server start to ensure repeatable jobs survive restarts.

### Cron Endpoints

All cron routes at `src/app/api/cron/` are protected by `verifyCronSecret()` (checks `Authorization: Bearer ${CRON_SECRET}`). Key crons: `sync-gsc`, `performance-test`, `calculate-scores`, `crawl-sites`, `perf-refresh`, `alerts`, `send-reports`, `gsc-refresh`.

### Key Lib Modules

| Module | Purpose |
|--------|---------|
| `lib/perf/psi.ts` | `fetchPsi()` - fetch + normalize PSI v5 (lab + field), mock mode |
| `lib/perf/psi-service.ts` | `runPsi()`, `saveSnapshot()`, `upsertDaily()` - canonical PSI persistence |
| `lib/gsc/fetch-daily.ts` | `fetchAndStoreGSCDaily()` - canonical GSC data ingestion |
| `lib/gsc/params.ts` | Query param parsing, CTR calc, delta helpers for API routes |
| `lib/scoring/calculator.ts` | `SEOCalculator.calculateSEOScore()` - canonical scoring |
| `lib/crawler/crawler-service.ts` | `CrawlerService`, `crawlSite()` |
| `lib/alerts/evaluator.ts` | `evaluateRule()` - compares SitePerfDaily vs thresholds |
| `lib/email/client.ts` | `sendEmail()` via Resend |
| `lib/reports/pdf-generator.tsx` | `renderReportPDF()` via @react-pdf/renderer |
| `lib/crypto.ts` | AES-256-GCM for GSC refresh token encryption |
| `lib/performance/thresholds.ts` | Core Web Vitals threshold constants |

### App Routes

**Route groups:** `(auth)/` for public auth pages, `(dashboard)/` for protected pages.

**Site pages** under `(dashboard)/sites/[siteId]/`:
`overview` (default landing) | `keywords` | `pages` | `performance` | `issues` | `reports` | `alerts` | `settings/alerts`

**Admin pages:** `(dashboard)/dashboard/jobs` (job monitoring)

## Development With Mock Data

Set in `.env.local` for development without real API keys:
- `MOCK_GSC=true` - Mock Google Search Console responses
- `MOCK_PSI=true` - Mock PageSpeed Insights responses

Workers no-op without `REDIS_URL`. The app runs standalone with just `DATABASE_URL`.

## Docker

`docker-compose.yml` runs 5 services: `app` (Next.js, port 3000), `workers` (BullMQ), `db` (PostgreSQL 17), `redis` (Redis 7.4 with AOF), `minio` (object storage, ports 9000/9001).

## Code Conventions

- **TypeScript** always - no `any`
- **Named exports** - not default
- Files: kebab-case (`site-selector.tsx`), Components: PascalCase (`SiteSelector`)
- **Server Components** by default, `'use client'` only when needed
- Path aliases: `@/*` → `src/*` (also `@/lib/*`, `@/components/*`, `@/hooks/*`, `@/types/*`)
- API route auth: `auth.api.getSession({ headers: await headers() })`, always scope queries by `organizationId`
- Cron route auth: `verifyCronSecret(request)`
- GSC tokens encrypted via `lib/crypto.ts` (AES-256-GCM, requires `ENCRYPTION_KEY`)

## Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

Colors: Green `#0cce6b`, Orange `#ffa400`, Red `#ff4e42`

## Known Architecture Issues

- **Legacy `SearchConsoleData` readers**: Some UI (reports, site-details, sites-list) still reads from `SearchConsoleData`. The sync pipeline now only writes to `SearchStatDaily`. These readers should be migrated.
- **Score double-write**: `score-worker.ts` calls `SEOCalculator` which writes via `storeSEOScore()`, then the worker also upserts at target date.
