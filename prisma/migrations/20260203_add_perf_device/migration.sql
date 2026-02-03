-- Add enum type
DO $$ BEGIN
  CREATE TYPE "PerfDevice" AS ENUM ('ALL', 'MOBILE', 'DESKTOP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add column with default 'ALL'
ALTER TABLE "site_perf_daily" ADD COLUMN IF NOT EXISTS "device" "PerfDevice" NOT NULL DEFAULT 'ALL';

-- Backfill existing rows to ALL (default already handles)
UPDATE "site_perf_daily" SET "device" = 'ALL' WHERE "device" IS NULL;

-- Drop old unique and index if exist, then create new compound unique
DO $$ BEGIN
  ALTER TABLE "site_perf_daily" DROP CONSTRAINT IF EXISTS "site_perf_daily_site_id_date_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "site_perf_daily_site_id_date_device_key" ON "site_perf_daily" ("site_id", "date", "device");

-- Optional: supporting index for queries
CREATE INDEX IF NOT EXISTS "site_perf_daily_site_id_date_device_idx" ON "site_perf_daily" ("site_id", "date", "device");
