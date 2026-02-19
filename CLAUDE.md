# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glimpse is an internal SEO dashboard for mahope.dk's ~25 WordPress customers. It pulls data from Google Search Console, runs PageSpeed Insights tests, crawls sites for issues, calculates composite SEO scores, monitors uptime, tracks competitors, and sends alerts/reports. Each customer (Organization) can have multiple sites and team members.

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
npx playwright test                               # E2E tests (requires build + DB)

# Lint
npm run lint             # next lint (ESLint 9)
```

## Tech Stack

Next.js 16.1+ (Turbopack, proxy.ts, `'use cache'`) | React 19 | Better Auth 1.x (magic link, organizations, Google OAuth) | PostgreSQL 17 via Prisma 6.2+ | Tailwind CSS 4.0 + shadcn/ui | Recharts | TanStack Query 5 | Redis + BullMQ | Resend (email) | Zod | Playwright (E2E) | Vitest (unit)

## Architecture

### Multi-Tenancy Model

```
Organization (Better Auth plugin)
├── Member[] (OWNER / ADMIN / MEMBER roles)
├── Invitation[] (pending team invitations)
├── NotificationChannel[] (Slack / Webhook integrations)
└── Site[] (1:N via organizationId)
    ├── SearchStatDaily (GSC data)
    ├── PerfSnapshot + SitePerfDaily (PSI data)
    ├── CrawlResult (crawl reports)
    ├── SEOScore (composite scores)
    ├── AlertRule[] → AlertEvent[] (threshold alerts)
    ├── UptimeCheck[] (uptime monitoring)
    ├── Competitor[] → CompetitorSnapshot[] (competitor benchmarks)
    └── Report[] (generated PDF reports)
```

Session carries `activeOrganizationId`. All site queries MUST filter by `organizationId` for tenant isolation.

### Auth (Better Auth)

- **Server config**: `src/lib/auth.ts` — Prisma adapter, magic link, organization plugin, Google OAuth
- **Client config**: `src/lib/auth-client.ts` — `useSession()`, `signIn`, `signOut`, `organization`
- **API handler**: `src/app/api/auth/[...all]/route.ts`
- **Route protection**: `proxy.ts` at project root (Next.js 16 replacement for middleware.ts)
- **Server-side session**: `auth.api.getSession({ headers: await headers() })`
- **Client-side session**: `useSession()` hook
- **Roles**: User-level (`ADMIN` / `CUSTOMER`), Organization-level (`OWNER` / `ADMIN` / `MEMBER`)
- **Admin guard**: `session.user.role === 'ADMIN'` for admin pages/API routes

### Data Pipeline

**GSC Data:** `gsc-sync` queue → `gsc-sync-worker` → `fetchAndStoreGSCDaily()` → `SearchStatDaily` table. Used by overview, keywords, pages API routes and `SEOCalculator` scoring.

**PSI Performance:** `performance-test` queue → `perf-worker` → `psi-service.ts` → `PerfSnapshot` + `SitePerfDaily`. Tracks per-device metrics (MOBILE/DESKTOP/ALL). Used by perf API routes, scoring, alerts.

**Scoring:** `lib/scoring/calculator.ts` — 5 weighted components: click trend 25%, position trend 25%, impression trend 20%, CTR benchmark 15%, performance 15%.

**Uptime:** `uptime-check` queue → `uptime-worker` — checks every 5 min, tracks incidents, dispatches notifications on status change.

**Crawl:** `site-crawl` queue → `crawl-worker` → `CrawlerService.crawlAndStoreSite()` — respects robots.txt, stores per-page issues, calculates site health metrics.

### Background Jobs (BullMQ)

Workers run as a separate process (`npm run workers`). They no-op gracefully without Redis.

| Queue | Schedule | Concurrency | Rate Limit |
|-------|----------|-------------|------------|
| `gsc-sync` | 02:00 daily | 3 | 10/min |
| `performance-test` | 04:00 daily | 2 | 5/min |
| `site-crawl` | 05:00 Sundays | 1 | 2/5min |
| `score-calculation` | 06:00 daily | 5 | 20/min |
| `uptime-check` | Every 5 min | 2 | — |

Key files: `src/lib/jobs/queue.ts` (queue definitions + `scheduleJob`/`triggerJob`), `src/lib/jobs/workers/` (worker instances), `src/lib/jobs/processors/` (slim processor functions), `src/lib/jobs/register.ts` (repeatable job registration), `src/lib/jobs/dead-letter.ts` (DLQ with email alerting).

`server-init.ts` calls `/api/jobs/register-on-boot` on every server start to ensure repeatable jobs survive restarts.

### Key Lib Modules

| Module | Purpose |
|--------|---------|
| `lib/perf/psi.ts` | `fetchPsi()` — PSI v5 API client with mock mode |
| `lib/perf/psi-service.ts` | `runPsi()`, `saveSnapshot()`, `upsertDaily()` — canonical PSI persistence, daily cap tracking |
| `lib/gsc/fetch-daily.ts` | `fetchAndStoreGSCDaily()` — canonical GSC data ingestion |
| `lib/gsc/params.ts` | Query param parsing, CTR calc, delta helpers for API routes |
| `lib/scoring/calculator.ts` | `SEOCalculator.calculateSEOScore()` — canonical scoring |
| `lib/crawler/crawler-service.ts` | `CrawlerService.crawlAndStoreSite()` — site crawling with health metrics |
| `lib/alerts/evaluator.ts` | `evaluateRule()` — compares SitePerfDaily/scores vs thresholds |
| `lib/notifications/dispatcher.ts` | `dispatchNotification()` — routes to Slack/webhook channels per org |
| `lib/notifications/slack.ts` | Slack incoming webhook sender with severity colors |
| `lib/notifications/webhook.ts` | Generic webhook with HMAC signing, SSRF protection (DNS validation) |
| `lib/metrics/collector.ts` | Redis-based metrics: API latency percentiles, counters, time series (lazy connection) |
| `lib/recommendations/engine.ts` | `generateRecommendations()` — analyzes perf/crawl/GSC for actionable suggestions |
| `lib/reports/pdf-generator.tsx` | `renderReportPDF()` via @react-pdf/renderer |
| `lib/email/client.ts` | `sendEmail()` via Resend |
| `lib/email/alerts.ts` | `sendAlertEmail()` — alert emails with recipient fallback chain |
| `lib/crypto.ts` | AES-256-GCM for GSC refresh token encryption |
| `lib/performance/thresholds.ts` | Core Web Vitals threshold constants |

### App Routes

**Route groups:** `(auth)/` for public auth pages, `(dashboard)/` for protected pages.

**Site pages** under `(dashboard)/sites/[siteId]/`:
`overview` | `keywords` | `pages` | `performance` | `issues` | `reports` | `alerts` | `uptime` | `competitors` | `settings/alerts`

**Settings pages** under `(dashboard)/settings/`:
`profile` | `notifications` (Slack/webhook channels) | `team` (members + invitations)

**Admin pages** under `(dashboard)/dashboard/`:
`jobs` (queue monitoring with retry/clean/inspect) | `metrics` (API latency, queue depths, PSI call rates, entity counts)

**Other:** `/invite/[invitationId]` (invitation acceptance) | `/onboarding` | `/sites/connect`

### API Routes

**Organization management:** `POST /organizations/invitations`, `POST /organizations/invitations/accept`, `GET|POST|PATCH|DELETE /organizations/notification-channels`, `POST /organizations/notification-channels/test`, `GET|POST|PATCH|DELETE /organizations/members`

**Admin:** `GET /admin/metrics`, `GET /jobs/status`, `POST /jobs/actions` (retry/remove/clean/inspect), `POST /jobs/trigger`

**Per-site:** `GET /sites/[siteId]/perf/daily` (device filter), `GET|POST /sites/[siteId]/alerts/rules`, `GET /sites/[siteId]/uptime`, `GET|POST /sites/[siteId]/competitors`, `GET /sites/[siteId]/recommendations`, `GET|POST /sites/[siteId]/reports`

**Cron (CRON_SECRET protected):** `sync-gsc`, `performance-test`, `calculate-scores`, `crawl-sites`, `perf-refresh`, `alerts`, `send-reports`, `gsc-refresh`

## Testing

**Unit tests (Vitest):** 32 test files in `tests/` — 77+ passing tests. Mock pattern: declare `vi.fn()` before `vi.mock()`, import modules after mocks. Mock `@prisma/client` enums as `{ ENUM: 'ENUM' }`. No DATABASE_URL or REDIS_URL required.

**E2E tests (Playwright):** 5 spec files in `e2e/`. Auth via direct Prisma session injection (bypasses magic link). Projects: Desktop Chrome + iPhone 14.

**CI:** `.github/workflows/ci.yml` (lint → type-check → test → build with PostgreSQL service), `.github/workflows/e2e.yml` (Playwright with Chromium).

## Development With Mock Data

Set in `.env.local` for development without real API keys:
- `MOCK_GSC=true` — Mock Google Search Console responses
- `MOCK_PSI=true` — Mock PageSpeed Insights responses

Workers no-op without `REDIS_URL`. Metrics collector no-ops without `REDIS_URL`. The app runs standalone with just `DATABASE_URL`.

## Docker

`docker-compose.yml` runs 5 services: `app` (Next.js, port 3000), `workers` (BullMQ), `db` (PostgreSQL 17), `redis` (Redis 7.4 with AOF), `minio` (object storage, ports 9000/9001).

## Code Conventions

- **TypeScript** always — no `any`
- **Named exports** — not default
- Files: kebab-case (`site-selector.tsx`), Components: PascalCase (`SiteSelector`)
- **Server Components** by default, `'use client'` only when needed
- Path aliases: `@/*` → `src/*`
- API route auth: `auth.api.getSession({ headers: await headers() })`, always scope queries by `organizationId`
- Admin route auth: additionally check `session.user.role === 'ADMIN'`
- Cron route auth: `verifyCronSecret(request)`
- Organization role guards: OWNER-only for granting ADMIN, removing ADMINs, managing notification channels
- GSC tokens encrypted via `lib/crypto.ts` (AES-256-GCM, requires `ENCRYPTION_KEY`)
- Notifications: always `try/catch` around `dispatchNotification()` — never block primary flows
- Metrics: fire-and-forget with `.catch(() => {})` — never block

## Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

Colors: Green `#0cce6b`, Orange `#ffa400`, Red `#ff4e42`

## Known Architecture Issues

- **Legacy `SearchConsoleData` readers**: Some UI (reports, site-details) still reads from `SearchConsoleData`. The sync pipeline only writes to `SearchStatDaily`. These readers should be migrated.
- **Score double-write**: `score-worker.ts` calls `SEOCalculator` which writes via `storeSEOScore()`, then the worker also upserts at target date.
- **Legacy `PerformanceTest` model**: Still in schema but unused by canonical PSI pipeline (`PerfSnapshot` + `SitePerfDaily`).
- **MinIO not integrated**: `docker-compose.yml` includes MinIO but no S3 client code exists yet. Reports/exports stored in DB, not object storage.
