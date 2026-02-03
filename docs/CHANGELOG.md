# Changelog

## Unreleased

### Added
- GSC aggregation endpoints now support:
  - Server-side sorting via `sort` (clicks|impressions|ctr|position) and `dir` (asc|desc)
  - Pagination totals: responses include `totalItems` and `totalPages`
  - Trend metrics per row: `trendClicks`, `trendImpressions`, `trendCtr`, `trendPosition`
- UI updated to consume totals and sort direction; basic pagination controls show `Page X / Y`.
- Tests: unit tests for param parsing/validation and trend helpers.
- Docs: README updated with sort, totals, and trend behavior.

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
