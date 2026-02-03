# Cron Endpoints

- POST /api/cron/send-reports — Generates previous month's PDF for all active sites and emails org admins/owners via Resend
- POST /api/cron/alerts — Sends alert emails when SEO score drops or performance tests fail
- POST /api/cron/perf-refresh — Enqueue daily PageSpeed fetches for each active site (supports ?siteId and ?limit query params)

All routes are secured via verifyCronSecret (Authorization: Bearer ${CRON_SECRET}).
