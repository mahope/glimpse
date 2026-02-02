# Changelog

## Unreleased

### Added
- Google Search Console daily ingestion pipeline:
  - New tables: search_stat_daily, keyword_summary, page_summary
  - Cron route: POST /api/cron/gsc-refresh?siteId=&days=30
  - Aggregation routes:
    - GET /api/sites/[siteId]/gsc/keywords
    - GET /api/sites/[siteId]/gsc/pages
- UI scaffolding for Keywords and Pages with TrendBadge and tables
- .env.example entries for SERVICE_ACCOUNT_JSON and MOCK_GSC

### Changed
- Site: added gscLastSyncedAt

### Notes
- Prisma SQL migration created offline due to missing local Postgres. Run `npm run db:migrate` after starting db to apply.
