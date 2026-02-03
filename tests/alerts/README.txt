Offline tests rely on mocked prisma and email.
- evaluator.spec.ts covers device-specific thresholds and score drop logic.
- api.cron.alerts.test.ts mocks prisma.site, alertRule, sitePerfDaily, alertEvent, and sendAlertEmail.
Set CRON_SECRET=test for the cron route tests.
