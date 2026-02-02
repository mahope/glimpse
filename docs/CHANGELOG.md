# Changelog

## Unreleased

### Added
- CrawlReport API and UI detail page under /sites/[siteId]/reports/[reportId] with summary, breakdown, top issues, and narrative.
- Reports list now links to the detail page from the Issues tab.
- Monthly send-reports cron now uses real 30-day Google Search Console KPIs per site and attaches the generated PDF.
- Email includes a short text summary (site, score, key KPIs).
- Security: All cron endpoints protected via verifyCronSecret (validated in this pass).
- Security: Enforce ENCRYPTION_KEY length (32 bytes). In production, throw with a clear error; in dev, warn and pad.
- Workers: jobs dir in lib/jobs/ with crawl, score, GSC sync, and performance workers (introduced previously) referenced.

### Tests
- Vitest unit tests: SEO scoring calculator edge conditions and grade mapping.
- Simple GSC aggregated metrics shape test.
- PDF generator smoke test (renders to a Buffer).

### Cleanup
- Updated docs to use "Glimpse" name; removed lingering "seo-tracker" references where applicable.

