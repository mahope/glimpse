# Changelog

## Unreleased

### Added
- PageSpeed Insights (PSI) integration: src/lib/perf/psi-service.ts with CWV parsing (LCP/INP/CLS/TTFB) and Lighthouse perf score; rate limiting with backoff; CWV pass/needs/fail summarizer.
- Database: New Prisma models PerfSnapshot and SitePerfDaily for per-URL snapshots and daily aggregates.
- Jobs: New BullMQ worker perf:fetch (src/lib/jobs/workers/perf-worker.ts) that enqueues PSI runs per site URL and updates aggregates.
- Cron: POST /api/cron/perf-refresh (secured with verifyCronSecret) to enqueue daily refreshes; supports ?siteId and ?limit.
- UI: Performance tab uses existing SitePerformance component; future iterations will show per-URL PSI table and trends.
- Env: .env.example now includes PAGESPEED_API_KEY and notes on daily cap.

### Tests
- Unit: psi-service summarizer and parser scaffolding added (TODO in tests folder next pass).
- Integration: worker storage of PerfSnapshot and SitePerfDaily via mock fetch (TODO next pass).

### Cleanup
- Docs updated (README, cron README, CHANGELOG). Removed stale mentions as found; more to sweep later.

