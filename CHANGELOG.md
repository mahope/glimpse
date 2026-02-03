# Changelog

## Unreleased
- feat(alerts): CRUD API for AlertRules with Zod validation and org-scoped authz
- feat(alerts): Interactive Settings → Alerts UI with optimistic create/update/delete and empty state
- feat(alerts): Seed script adds sensible default rules to active sites (npm run seed:alerts)
- feat(alerts): Cron honors per-rule recipients; falls back to site owners; polished email template
- tests(alerts): Offline-friendly unit tests for rules CRUD
- docs(alerts): README docs for Alerts UI and seeding
- feat(perf): PSI integration with typed fetch and normalization (src/lib/perf/psi.ts)
- feat(api): GET /api/sites/[siteId]/perf with in-memory cache and strategy filter
- feat(ui): Performance dashboard page with mobile/desktop cards, CWV status coloring, and Refresh PSI
- feat(reports): performance section mapper for future PDF reports
- docs(env): .env.example updated with GOOGLE_PSI_API_KEY and MOCK_PSI
- tests: unit tests for PSI param builder/extraction and report mapper

## Previous
- See repo history for earlier phases (GSC sorting & sortable UI shipped in phase-14)
