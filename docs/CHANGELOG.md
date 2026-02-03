# Changelog

## Unreleased

### Added
- UI: Keywords and Pages tables now have clickable sortable headers; current sort shown with up/down arrows. Sort and direction sync to URL and persist across pagination and filters.
- API: CTR sorting made consistent by computing CTR from clicks/impressions and applying a deterministic in-memory sort with tie-breakers (clicks desc, impressions desc, key asc). Pagination slices after sort for stability. Position sort treats lower as better.
- Tests: Added parseParams coverage for sort + dir; added unit tests for CTR sort behavior and tie-breakers (uses pure functions, no DB/Redis). Existing tests remain green; DB-dependent tests are skipped when DB is not available.
- Docs: README updated with sortable headers, CTR sort behavior, tie-breakers, and pagination details.

### Existing (from previous phase)
- Google Search Console daily ingestion pipeline:
  - New tables: search_stat_daily, keyword_summary, page_summary
  - Cron route: POST /api/cron/gsc-refresh?siteId=&days=30
  - Aggregation routes:
    - GET /api/sites/[siteId]/gsc/keywords
    - GET /api/sites/[siteId]/gsc/pages
- Keywords/Pages dashboard wiring (client) with filters, sorting, pagination, and loading/empty/error states
- BullMQ worker `gsc:fetch` with backoff/limiter; safe no-op when REDIS_URL missing
- Scheduler endpoints:
  - POST /api/jobs/gsc-enqueue (Authorization: Bearer ${CRON_SECRET})
  - POST /api/jobs/register-on-boot (Authorization: Bearer ${CRON_SECRET})
- README updated with worker runbook and MOCK_GSC instructions
- .env.example entries for SERVICE_ACCOUNT_JSON and MOCK_GSC

### Changed
- Site: added gscLastSyncedAt

### Notes
- Prisma SQL migration created offline due to missing local Postgres. Run `npm run db:migrate` after starting db to apply.
