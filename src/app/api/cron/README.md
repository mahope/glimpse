# Cron Endpoints

- POST /api/cron/send-reports — Generates previous month's PDF for all active sites and emails org admins/owners via Resend
- POST /api/cron/alerts — Sends alert emails when SEO score drops or performance tests fail

Protect these with CRON_SECRET middleware if exposing publicly.
