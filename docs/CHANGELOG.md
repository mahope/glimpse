# Changelog

## Unreleased

### Added
- PageSpeed Insights (PSI) integration: src/lib/perf/psi-service.ts with CWV parsing (LCP/INP/CLS/TTFB) and Lighthouse perf score; rate limiting with backoff; CWV pass/needs/fail summarizer.
- Database: New Prisma models PerfSnapshot and SitePerfDaily for per-URL snapshots and daily aggregates.
- Jobs: New BullMQ worker perf:fetch (src/lib/jobs/workers/perf-worker.ts) that enqueues PSI runs per site URL and updates aggregates.
- Cron: POST /api/cron/perf-refresh (secured with verifyCronSecret) to enqueue daily refreshes; supports ?siteId and ?limit.
- API: New routes
  - GET /api/sites/[siteId]/perf/latest?strategy=mobile|desktop&page=&pageSize= — latest snapshot per URL with pagination
  - GET /api/sites/[siteId]/perf/daily?days=30 — 30-day aggregates from SitePerfDaily
- UI: New Performance tab with Latest table and Trends (30-day KPIs). Responsive with loading/empty/error states.
- Env: .env.example lists PAGESPEED_API_KEY, CRON_SECRET, REDIS_URL.

### Tests
- Unit: psi-service summarizer and parser tests.
- Integration: seeds snapshots and asserts latest/daily query shapes.

### DX
- NPM scripts: db:migrate, db:generate, db:studio

### Cleanup
- Docs updated (README, cron README, CHANGELOG). Removed stale mentions as found; more to sweep later.

