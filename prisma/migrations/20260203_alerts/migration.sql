-- Enums
DO $$ BEGIN
  CREATE TYPE "AlertMetric" AS ENUM ('LCP','INP','CLS','SCORE_DROP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertStatus" AS ENUM ('OPEN','RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "alert_rule" (
  "id" TEXT PRIMARY KEY,
  "site_id" TEXT NOT NULL,
  "metric" "AlertMetric" NOT NULL,
  "device" "PerfDevice" NOT NULL DEFAULT 'ALL',
  "threshold" DOUBLE PRECISION NOT NULL,
  "window_days" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "recipients" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "alert_event" (
  "id" TEXT PRIMARY KEY,
  "site_id" TEXT NOT NULL,
  "metric" "AlertMetric" NOT NULL,
  "device" "PerfDevice" NOT NULL DEFAULT 'ALL',
  "date" TIMESTAMP(3) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "rule_id" TEXT,
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FKs
DO $$ BEGIN
ALTER TABLE "alert_rule"
  ADD CONSTRAINT "alert_rule_site_fk" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "alert_event"
  ADD CONSTRAINT "alert_event_site_fk" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "alert_event"
  ADD CONSTRAINT "alert_event_rule_fk" FOREIGN KEY ("rule_id") REFERENCES "alert_rule"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "alert_rule_site_metric_device_idx" ON "alert_rule" ("site_id","metric","device");
CREATE UNIQUE INDEX IF NOT EXISTS "alert_event_site_metric_device_date_uq" ON "alert_event" ("site_id","metric","device","date");
CREATE INDEX IF NOT EXISTS "alert_event_site_status_date_idx" ON "alert_event" ("site_id","status","date");
