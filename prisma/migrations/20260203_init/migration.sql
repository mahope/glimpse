-- Prisma migration for initial schema including PerfSnapshot and SitePerfDaily
-- Generated offline via `prisma migrate diff --from-empty --to-schema-datamodel`

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER');
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'DESKTOP');
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- Tables
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active_organization_id" TEXT,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verificationtoken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gsc_property_url" TEXT,
    "gsc_refresh_token" TEXT,
    "gsc_connected_at" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_console_data" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "query" TEXT,
    "page" TEXT,
    "country" TEXT,
    "device" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_console_data_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_test" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "test_url" TEXT NOT NULL,
    "device" "DeviceType" NOT NULL,
    "score" INTEGER,
    "lcp" DOUBLE PRECISION,
    "inp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "ttfb" DOUBLE PRECISION,
    "fcp" DOUBLE PRECISION,
    "speedIndex" DOUBLE PRECISION,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "lighthouse_version" TEXT,
    "test_duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "performance_test_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "perf_snapshot" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" "DeviceType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lcpMs" INTEGER,
    "inpMs" INTEGER,
    "cls" DOUBLE PRECISION,
    "ttfbMs" INTEGER,
    "perfScore" INTEGER,
    "is_field" BOOLEAN,
    "is_lab" BOOLEAN,
    "raw" JSONB,
    CONSTRAINT "perf_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_perf_daily" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lcp_pctl" INTEGER,
    "inp_pctl" INTEGER,
    "cls_pctl" INTEGER,
    "perf_score_avg" INTEGER,
    "pages_measured" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "site_perf_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seo_score" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "click_trend" INTEGER NOT NULL,
    "position_trend" INTEGER NOT NULL,
    "impression_trend" INTEGER NOT NULL,
    "ctr_benchmark" INTEGER NOT NULL,
    "performance_score" INTEGER,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_score_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crawl_result" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "crawl_date" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "load_time_ms" INTEGER NOT NULL,
    "title" TEXT,
    "meta_description" TEXT,
    "h1_count" INTEGER NOT NULL DEFAULT 0,
    "h2_count" INTEGER NOT NULL DEFAULT 0,
    "total_images" INTEGER NOT NULL DEFAULT 0,
    "images_without_alt" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "content_length" INTEGER NOT NULL DEFAULT 0,
    "total_links" INTEGER NOT NULL DEFAULT 0,
    "internal_links" INTEGER NOT NULL DEFAULT 0,
    "external_links" INTEGER NOT NULL DEFAULT 0,
    "broken_links" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crawl_result_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crawl_report" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "pages_crawled" INTEGER NOT NULL DEFAULT 0,
    "totals" JSONB,
    "issue_breakdown" JSONB,
    "top_issues" JSONB,
    "summary" TEXT,
    CONSTRAINT "crawl_report_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "session_session_token_key" ON "session"("session_token");
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");
CREATE UNIQUE INDEX "verificationtoken_token_key" ON "verificationtoken"("token");
CREATE UNIQUE INDEX "verificationtoken_identifier_token_key" ON "verificationtoken"("identifier", "token");
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");
CREATE UNIQUE INDEX "member_organization_id_user_id_key" ON "member"("organization_id", "user_id");
CREATE UNIQUE INDEX "site_organization_id_domain_key" ON "site"("organization_id", "domain");
CREATE INDEX "search_console_data_site_id_date_idx" ON "search_console_data"("site_id", "date");
CREATE INDEX "search_console_data_site_id_query_idx" ON "search_console_data"("site_id", "query");
CREATE INDEX "search_console_data_site_id_page_idx" ON "search_console_data"("site_id", "page");
CREATE UNIQUE INDEX "search_console_data_site_id_date_query_page_country_device_key" ON "search_console_data"("site_id", "date", "query", "page", "country", "device");
CREATE INDEX "performance_test_site_id_createdAt_idx" ON "performance_test"("site_id", "createdAt");
CREATE INDEX "performance_test_site_id_device_idx" ON "performance_test"("site_id", "device");
CREATE INDEX "perf_snapshot_site_id_date_idx" ON "perf_snapshot"("site_id", "date");
CREATE INDEX "perf_snapshot_site_id_url_idx" ON "perf_snapshot"("site_id", "url");
CREATE INDEX "perf_snapshot_site_id_strategy_date_idx" ON "perf_snapshot"("site_id", "strategy", "date");
CREATE INDEX "site_perf_daily_site_id_date_idx" ON "site_perf_daily"("site_id", "date");
CREATE UNIQUE INDEX "site_perf_daily_site_id_date_key" ON "site_perf_daily"("site_id", "date");
CREATE INDEX "seo_score_site_id_date_idx" ON "seo_score"("site_id", "date");
CREATE UNIQUE INDEX "seo_score_site_id_date_key" ON "seo_score"("site_id", "date");
CREATE INDEX "crawl_result_site_id_crawl_date_idx" ON "crawl_result"("site_id", "crawl_date");
CREATE INDEX "crawl_result_site_id_url_idx" ON "crawl_result"("site_id", "url");
CREATE INDEX "crawl_report_site_id_started_at_idx" ON "crawl_report"("site_id", "started_at");

-- FKs
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site" ADD CONSTRAINT "site_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_console_data" ADD CONSTRAINT "search_console_data_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_test" ADD CONSTRAINT "performance_test_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "perf_snapshot" ADD CONSTRAINT "perf_snapshot_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_perf_daily" ADD CONSTRAINT "site_perf_daily_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_score" ADD CONSTRAINT "seo_score_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_result" ADD CONSTRAINT "crawl_result_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_report" ADD CONSTRAINT "crawl_report_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
