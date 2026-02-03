# Cron Endpoints

- POST /api/cron/send-reports — Generates previous month's PDF for all active sites and emails org admins/owners via Resend
- POST /api/cron/alerts — Evaluates per-site alert rules (LCP/INP/CLS thresholds, score drop) against SitePerfDaily and creates/debounces/resolves AlertEvents. Sends emails via Resend.
- POST /api/cron/perf-refresh — Enqueue daily PageSpeed fetches for each active site (supports ?siteId and ?limit query params)

All routes are secured via verifyCronSecret (Authorization: Bearer ${CRON_SECRET}).
