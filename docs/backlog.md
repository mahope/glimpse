# Glimpse — Backlog

> 50 prioriterede opgaver for stabilitet, features, UI/UX, performance og brugervenlighed.
> Oprettet: 2026-02-19

---

## Kategori 1: Kritiske Sikkerhedsfejl

### ~~1. Tilføj auth-check på PDF report-endpoint~~ DONE

**Fil:** `src/app/api/sites/[siteId]/report/route.ts`

`GET /api/sites/[siteId]/report` genererer en komplet PDF-rapport med alle GSC-data, performance-metrics og crawl-resultater for et site — men har ingen session-verifikation eller org-boundary-check. Enhver uautentificeret bruger der kender et `siteId` (cuid) kan downloade rapporten.

**Krav:**
- Tilføj `auth.api.getSession({ headers })` check
- Verificer at sitet tilhører brugerens `activeOrganizationId`
- Returner 401/403 ved manglende/ugyldig session
- Tilføj test der verificerer at uautentificerede requests afvises

---

### ~~2. Aktiver multi-tenancy på /api/sites~~ DONE

**Fil:** `src/app/api/sites/route.ts` (linje 22 og 70)

Både GET og POST handlers har org-filter kommenteret ud med `// TODO`. GET returnerer ALLE sites i databasen til enhver autentificeret bruger. POST opretter sites under en hardkodet "Default Organization". Dette er en data-lækage mellem kunder.

**Krav:**
- Uncomment og aktiver `organizationId`-filter i GET handler
- Kræv `activeOrganizationId` i POST handler — afvis hvis mangler
- Fjern "Default Organization" fallback
- Returner 400 hvis bruger ikke har aktiv organization
- Tilføj integrationstests for org-boundary

---

### ~~3. Fix GSC token-kryptering i OAuth callback~~ DONE

**Fil:** `src/app/api/gsc/callback/route.ts`

`encryptToken()`-funktionen i callback-routen er en no-op stub der returnerer tokenet i klartekst:
```typescript
async function encryptToken(raw: string) {
  // Simple passthrough in dev; replace with AES-GCM using ENCRYPTION_KEY in prod
  return raw
}
```
Tokens gemmes som plain JSON i en cookie under OAuth-flowet (1 times max-age). Selvom tokenet krypteres korrekt når det gemmes i databasen (via `lib/crypto.ts`), er det sårbart i cookie-vinduet.

**Krav:**
- Brug `lib/crypto.ts` `encryptToken()` i callback-routen
- Slet den lokale stub-funktion
- Overvej at gemme token direkte i databasen i stedet for cookie (kortere eksponeringsvindue)
- Test at krypteret token kan dekrypteres korrekt i connect-routen

---

### ~~4. Tilføj API rate limiting~~ DONE

**Filer:** Ny middleware eller per-route rate limiter

Ingen API-endpoints har rate limiting. En autentificeret bruger kan:
- Kalde `POST /api/sites/[siteId]/psi` 100 gange og opbruge hele PSI-kvoten (200/dag)
- Trigger ubegrænsede job via `POST /api/jobs/trigger`
- Spam crawl-endpoints og belaste serveren

**Krav:**
- Redis-baseret sliding-window rate limiter (BullMQ Redis er allerede tilgængelig)
- PSI-endpoint: max 5 requests per site per time
- Job trigger: max 10 requests per bruger per minut
- Crawl trigger: max 1 per site per time
- Auth endpoints: Better Auth har built-in rate limiting — verificer at det er aktiveret
- Returner `429 Too Many Requests` med `Retry-After` header

---

## Kategori 2: Stabilitet & Bugfixes

### ~~5. Fix manglende shadcn-komponenter (Dialog, Progress)~~ DONE

**Filer:** `src/components/ui/dialog.tsx` (mangler), `src/components/ui/progress.tsx` (mangler)

To shadcn-komponenter importeres men eksisterer ikke:
- `Dialog`/`DialogContent` importeres i `ReportPreview` → Reports-sidens Preview-knap crasher ved klik
- `Progress` importeres i `SEOScoreOverview` → SEO score-komponenten crasher

**Krav:**
- Installer begge via `npx shadcn@latest add dialog progress`
- Verificer at Reports Preview og SEOScoreOverview renderer korrekt
- Tilføj disse til en UI smoke-test

---

### ~~6. Fix SiteSelector — erstat mock data med API-kald~~ DONE

**Fil:** `src/components/layout/site-selector.tsx` (linje 20)

SiteSelector i topbaren bruger hardkodede `mockSites` og henter aldrig brugerens rigtige sites. Brugere kan ikke skifte mellem deres sites.

**Krav:**
- Hent sites fra `/api/sites` filtreret på brugerens aktive organization
- Brug TanStack Query for caching og loading state
- Vis loading skeleton mens data hentes
- Opdater selectedSite via URL-parameter eller context
- Synkroniser med `[siteId]` i URL'en

---

### ~~7. Fix SEOCalculator — migrer fra SearchConsoleData til SearchStatDaily~~ DONE

**Fil:** `src/lib/scoring/calculator.ts`

`calculateClickTrend`, `calculateImpressionTrend` og `calculatePositionTrend` querier `SearchConsoleData`-tabellen med `query: '', page: '', country: 'all', device: 'all'` (det gamle aggregate-row mønster). Den kanoniske pipeline skriver til `SearchStatDaily`. Efter fuld migration vil scoring altid returnere 0 for click/impression trends.

**Krav:**
- Omskriv alle tre metoder til at aggregere fra `SearchStatDaily`
- Brug `SUM(clicks)`, `SUM(impressions)`, `AVG(position)` over datointervallet
- Bevar 30-dages vs. foregående 30-dages sammenligning
- Erstat `seoScore.create` med `seoScore.upsert` (undgå unique constraint-fejl ved gentagelse)
- Opdater tests med korrekte mocks

---

### ~~8. Fix score-worker double-write~~ DONE

**Fil:** `src/lib/jobs/workers/score-worker.ts` (linje 44)

`SEOCalculator.calculateSEOScore()` kalder internt `storeSEOScore()` med `create`. Workeren kalder derefter selv `prisma.seoScore.upsert` med `targetDate`. Når `targetDate === today`, skrives scoren to gange. Derudover bruger `storeSEOScore` `create` i stedet for `upsert`, så genafvikling af jobbet på samme dag giver en Prisma unique constraint-fejl.

**Krav:**
- Ændre `storeSEOScore()` til `upsert` i stedet for `create`
- Fjern den sekundære upsert i score-workeren — lad `SEOCalculator` håndtere al persistering
- Tilføj test for idempotent score-beregning (kald to gange på samme dag)

---

### ~~9. Fix gscQueue.ts — deprecated API og forkerte feltnavn~~ DONE

**Fil:** `src/lib/jobs/gscQueue.ts`

Tre fejl i denne fil:
1. Bruger `QueueScheduler` som blev fjernet i BullMQ 3+ (projektet bruger 5+)
2. `prisma.site.findMany({ where: { active: true } })` — feltet hedder `isActive`, ikke `active`. Returnerer altid tom liste.
3. `redisConnection` sættes med `maxRetriesPerRequest: 3` — BullMQ workers kræver `null` for blocking commands.

**Krav:**
- Fjern `QueueScheduler`-import og -instantiering
- Ret `active` til `isActive`
- Sæt `maxRetriesPerRequest: null` for worker-connections
- Overvej at konsolidere `gsc:fetch`-køen ind i den primære `gsc-sync`-kø

---

### ~~10. Fix Google Sign-In knap på login-side~~ DONE

**Fil:** `src/app/(auth)/sign-in/page.tsx`

Google OAuth-knappen renderer med et Google G-ikon men har ingen `onClick`-handler. Knappen er ikke-funktionel. Brugere forventer at kunne logge ind med Google.

**Krav:**
- Tilføj `onClick={() => signIn.social({ provider: 'google' })}` fra `auth-client.ts`
- Tilføj loading state mens redirect sker
- Erstat `alert()` fejlhåndtering med toast-systemet
- Test happy path og fejl-scenarie

---

### ~~11. Opret manglende /api/health endpoint~~ DONE

**Filer:** `src/app/api/health/route.ts` (ny), `healthcheck.js`

`healthcheck.js` (Docker HEALTHCHECK) kalder `GET /api/health`, men routen eksisterer ikke. Docker markerer containeren som unhealthy efter 90 sekunder, hvilket kan trigge uønskede restarts.

**Krav:**
- Opret `GET /api/health` der checker database-forbindelse (`prisma.$queryRaw('SELECT 1')`)
- Returner `{ status: 'ok', db: true, redis: boolean }` med 200
- Returner 503 hvis database er nede
- Ingen auth-check (healthcheck-endpoint skal være offentligt)

---

### ~~12. Fix connect-side server/client mixing~~ DONE

**Fil:** `src/app/(dashboard)/sites/connect/page.tsx`

Filen har `'use client'` midt i filen efter en server component export. Dette er et ugyldigt Next.js-mønster der kan give uforudsigelig opførsel.

**Krav:**
- Split i en server-component (`page.tsx`) og en client-component (`ConnectClient.tsx`)
- Server-component henter session og passerer som prop
- Client-component håndterer OAuth flow og property-valg
- Erstat `alert()` med toast-systemet

---

## Kategori 3: Data Pipeline Konsolidering

### ~~13. Konsolider GSC-sync til én pipeline~~ DONE

**Filer:** `lib/gsc/sync.ts`, `lib/gsc/gsc-service.ts`, `lib/gsc/fetch-daily.ts`, `lib/jobs/gscQueue.ts`, `lib/jobs/workers/gsc-sync-worker.ts`

To parallelle GSC-sync pipelines eksisterer:
- **Legacy:** `gsc-sync` kø → `gsc-sync-worker` → `syncSiteGSCData()` → `SearchConsoleData`-tabel
- **Kanonisk:** `gsc:fetch` kø → inline worker i `gscQueue.ts` → `fetchAndStoreGSCDaily()` → `SearchStatDaily`-tabel

Begge kører dagligt og henter overlappende data. Overview/keywords/pages API'er læser kun fra `SearchStatDaily`.

**Krav:**
- Fjern `gsc:fetch`-køen og dens inline worker
- Opdater `gsc-sync-worker` til at kalde `fetchAndStoreGSCDaily()` i stedet for `syncSiteGSCData()`
- Marker `lib/gsc/sync.ts` (`GSCDataSyncService`) som deprecated — det referencer felter (`gscTokens`, `lastSyncedAt`) der ikke eksisterer i schema
- Opdater SEOCalculator til at læse `SearchStatDaily` (se opgave #7)
- Planlæg migration af historiske `SearchConsoleData` → `SearchStatDaily`

---

### ~~14. Konsolider PSI-workers til én pipeline~~ DONE

**Filer:** `lib/jobs/workers/performance-worker.ts`, `lib/jobs/workers/perf-worker.ts`, `lib/performance/pagespeed-client.ts`

To PSI-workers kører parallelt:
- **Legacy:** `performance-worker.ts` → `pagespeed-client.ts` → `PerformanceTest`-tabel
- **Kanonisk:** `perf-worker.ts` → `psi-service.ts` → `PerfSnapshot` + `SitePerfDaily`

**Krav:**
- Fjern `performance-worker.ts` og stop registrering i `workers/index.ts`
- Fjern `lib/performance/pagespeed-client.ts`
- Omdøb `performance-test` køen til `perf:fetch` (eller omvendt) — én kø, én worker
- Opdater cron-endpoints til at bruge den kanoniske kø
- Bevar `lib/performance/thresholds.ts` (bruges af UI)
- Planlæg deprecation af `PerformanceTest`-modellen

---

### ~~15. Konsolider scoring til én implementering~~ DONE

**Filer:** `lib/scoring/calculator.ts`, `lib/scoring/seo-scoring.ts`

To scoring-klasser eksisterer:
- **Legacy:** `SEOScoring` (4 komponenter: performance/content/technical/search, 0-25 each)
- **Kanonisk:** `SEOCalculator` (5 vægtede komponenter, PRD-aligned)

**Krav:**
- Verificer at ingen kode importerer `SEOScoring`
- Fjern `lib/scoring/seo-scoring.ts`
- Dokumenter det kanoniske scoring-system i CLAUDE.md

---

## Kategori 4: Infrastruktur & DevOps

### ~~16. Implementer struktureret logging~~ DONE

**Alle filer**

Al logging bruger `console.log/error/warn`. Ingen request IDs, ingen korrelations-IDs, ingen struktureret JSON. Log-aggregering (CloudWatch, Datadog, etc.) er umulig.

**Krav:**
- Tilføj en letvægts-logger (f.eks. `pino` med `pino-pretty` i dev)
- Strukturér logs som JSON med: `timestamp`, `level`, `message`, `requestId`, `siteId`, `jobId`
- Tilføj request-ID middleware i proxy.ts eller via en utility
- Erstat alle `console.log/error/warn` kald
- Workers skal logge med `jobId` og `queueName` context

---

### ~~17. Tilføj BullMQ dead letter queue og job-fejl-alerting~~ DONE

**Filer:** `lib/jobs/queue.ts`, ny alert-integration

Fejlede jobs akkumuleres op til `removeOnFail: 50` og forsvinder derefter. Ingen besked når jobs permanent fejler. Ingen DLQ til inspektion.

**Krav:**
- Opret en `dead-letter` kø
- Konfigurer alle 4 primære køer til at flytte jobs til DLQ efter `attempts` er opbrugt
- Tilføj en `onFailed` listener der logger job-ID, fejl, og antal forsøg
- Send email-alert til admin når DLQ-dybde overstiger threshold (f.eks. 10 jobs)
- Tilføj DLQ-visning i admin jobs-dashboard

---

### ~~18. Hærdn docker-compose til produktion~~ DONE

**Fil:** `docker-compose.yml`

Flere produktionsproblemer:
- Ingen resource limits (CPU/memory) på services
- Hardkodede passwords (`seo_dashboard_2026`, `glimpse_minio_2026`)
- DB (5432) og Redis (6379) porte eksponeret til host-netværket
- Ingen healthcheck på `app` service i compose
- MinIO inkluderet men ubrugt
- `app_logs` volume mountet men aldrig skrevet til

**Krav:**
- Tilføj `mem_limit` og `cpus` på alle services
- Flyt passwords til Docker secrets eller `.env`
- Fjern port-mapping på `db` og `redis` (intern kommunikation via netværk)
- Tilføj healthcheck på `app` service: `test: ["CMD", "node", "healthcheck.js"]`
- Fjern MinIO service (eller implementer S3-storage for rapporter)
- Fjern ubrugt `app_logs` volume

---

### ~~19. Fix PSI daily cap — flyt til Redis~~ DONE

**Fil:** `src/lib/perf/psi-service.ts`

PSI API-kvoten er 200 kald/dag. Tælleren er in-process (`dailyCount`, `dayStamp` som module-level variabler). Den nulstilles ved worker-restart. Med `app` og `workers` som separate containers har de uafhængige tællere.

**Krav:**
- Gem tæller i Redis med key `psi:daily:YYYY-MM-DD` og TTL 25 timer
- `INCR` + `GET` atomisk per PSI-kald
- Returner tidligt hvis tæller >= cap (konfigurerbar via env)
- Log warning ved 80% af kvoten
- Sti: `lib/perf/psi-service.ts` → tilføj `incrementDailyCount()` helper

---

### ~~20. Implementer timing-safe CRON_SECRET sammenligning~~ DONE

**Fil:** `src/lib/cron/auth.ts`

`verifyCronSecret()` bruger direkte `!==` string-sammenligning, hvilket er sårbart over for timing-angreb.

**Krav:**
- Brug `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
- Håndter edge case hvor længderne er forskellige (pad eller sammenlign længde først)

---

## Kategori 5: Performance Optimering

### ~~21. Reducer PerfSnapshot.raw bloat~~ DONE

**Fil:** `lib/perf/psi-service.ts`, Prisma schema

Hele PSI JSON-responset (200-500KB) gemmes i `PerfSnapshot.raw`. For 25 sites × 2 strategier dagligt er det 50+ store JSON-blobs/dag → ~10GB/år.

**Krav:**
- Gem kun relevante felter fra PSI-responset (metrics, scores, audit summaries)
- Tilføj en `rawSlim` eller erstat `raw` med en stripped version (~5-10KB)
- Tilføj en migration der truncaterer historiske `raw`-felter
- Alternativt: flyt `raw` til object storage (MinIO/S3) med en reference i databasen

---

### ~~22. Tilføj database-indexes for hyppige queries~~ DONE

**Fil:** `prisma/schema.prisma`

Manglende indexes på:
- `Session.userId` — `getSession` joiner sessions til users
- `Member.userId` — org-lookups per bruger
- `AlertEvent(siteId, metric, device, status)` — debounce-query i alerts cron
- `PerfSnapshot(siteId, strategy, createdAt)` — scoring performance-query

**Krav:**
- Tilføj `@@index([userId])` på Session
- Tilføj `@@index([userId])` på Member
- Tilføj `@@index([siteId, metric, device, status])` på AlertEvent
- Tilføj `@@index([siteId, strategy, createdAt])` på PerfSnapshot
- Kør `prisma migrate dev` og verificer ingen breaking changes

---

### ~~23. Implementer server-side pagination på GSC-endpoints~~ DONE

**Filer:** `src/app/api/sites/[siteId]/gsc/keywords/route.ts`, `src/app/api/sites/[siteId]/gsc/pages/route.ts`

Keywords og pages API'er henter ALLE rækker fra databasen, sorterer in-memory (`lib/gsc/sort.ts`), og slicerer derefter for pagination. For sites med 10.000+ keywords belaster dette memory og er langsomt.

**Krav:**
- Flyt ORDER BY til Prisma-queryen (dynamisk baseret på sort-parameter)
- Brug `skip` + `take` i Prisma i stedet for in-memory slice
- Returner `totalCount` for korrekt pagination UI
- Bevar eksisterende sort-parametre (`clicks`, `impressions`, `ctr`, `position`)
- Benchmark med 10.000+ rækker

---

### ~~24. Cache dashboard overview-data~~ DONE

**Fil:** `src/app/api/sites/[siteId]/overview/route.ts`

Overview-routen laver 4 separate Prisma aggregate-queries per request (totalClicks, totalImpressions, avgCTR, avgPosition + daglig tidslinje). Data ændrer sig kun dagligt (efter GSC sync kl. 02:00).

**Krav:**
- Tilføj `'use cache'` (Next.js 16 Cache Components) eller Redis-cache med 1 time TTL
- Invalidér cache efter succesfuld GSC sync
- Returner `Cache-Control: public, max-age=3600` header
- Mål response-tid før og efter

---

### ~~25. Flyt crawl fra synkron HTTP til baggrundsjob~~ DONE

**Fil:** `src/app/api/sites/[siteId]/crawl/route.ts`

POST-handleren kører crawl synkront i HTTP-requesten. En 25-sides crawl med 1s delay tager 25+ sekunder og vil timeoute.

**Krav:**
- Enqueue crawl-job til `site-crawl` køen via `triggerJob.crawl()`
- Returner 202 Accepted med job-ID
- Tilføj polling-endpoint eller WebSocket for crawl-status
- Bevar den eksisterende `crawl-worker.ts` processor

---

## Kategori 6: UI/UX Forbedringer

### ~~26. Implementer dark mode toggle~~ DONE

**Filer:** `src/app/globals.css`, `src/app/layout.tsx`, ny `ThemeProvider`

CSS-variabler for `.dark` theme eksisterer allerede i `globals.css`, men der er ingen toggle, ingen `ThemeProvider`, og ingen `next-themes` integration. Temaet er uopnåeligt for brugere.

**Krav:**
- Installer `next-themes`
- Opret `ThemeProvider` wrapper i `layout.tsx` med `attribute="class"`
- Tilføj toggle-knap i dashboard header (sol/måne-ikon)
- Persist valg i localStorage
- Tilføj `suppressHydrationWarning` på `<html>`

---

### ~~27. Tilføj Next.js loading.tsx og error.tsx på alle routes~~ DONE

**Filer:** Nye filer under `src/app/(dashboard)/`

Ingen route-level loading states eller error boundaries eksisterer. Server Components der fejler giver en hvid side. Loading har ingen visuelt feedback.

**Krav:**
- `(dashboard)/loading.tsx` — fuld-side skeleton med sidebar + content placeholders
- `(dashboard)/sites/[siteId]/loading.tsx` — site-specifik skeleton med SiteNav + content area
- `(dashboard)/error.tsx` — fejlside med "Noget gik galt" besked + "Prøv igen" knap
- `(dashboard)/not-found.tsx` — 404-side med link til dashboard
- Brug shadcn Skeleton-komponent (installer med `npx shadcn@latest add skeleton`)

---

### ~~28. Erstat alle alert()/confirm() med toast/dialog~~ DONE

**Filer:** Mange komponenter

Mindst 7 komponenter bruger `alert()` eller `confirm()` browser-dialogs:
- `JobMonitor`, `ManualJobTrigger` i `sites-list.tsx`, `SitePerformance`, `GSCConnectClient`, `RulesClient`, `sign-in/page.tsx`

**Krav:**
- Erstat `alert()` med `toast('success'|'error', message)` fra `ui/toast.tsx`
- Erstat `confirm()` med en shadcn `AlertDialog`-komponent
- Installer `npx shadcn@latest add alert-dialog`
- Opgradér toast-systemet: tilføj dismiss-knap, fade animation, collision-safe IDs

---

### ~~29. Byg rigtig dashboard-landingsside med aggregeret data~~ DONE

**Fil:** `src/app/(dashboard)/dashboard/page.tsx`

Hele dashboard-landingssiden viser hardkodede mock-data. Alle 6 komponenter (KpiCards, ClicksChart, PositionChart, PerformanceOverview, TopKeywords, TopPages) har statiske værdier.

**Krav:**
- Hent aggregeret data på tværs af brugerens sites via ny API-route (`/api/dashboard/overview`)
- KPI-kort: Sum af clicks/impressions, gennemsnitlig CTR/position for alle sites
- Charts: Aggregeret tidslinje eller per-site sammenligning
- Top keywords/pages: Sorteret på tværs af alle sites
- Performance overview: Gennemsnitlig score, dårligst performende site highlighted
- Loading skeletons + error states

---

### ~~30. Tilføj global SiteNav og settings-links~~ DONE

**Filer:** `src/components/layout/site-nav.tsx`, `src/components/layout/dashboard-layout.tsx`

- `SiteNav` mangler tabs for "Alerts" og "Settings" — disse sider er uopnåelige via navigation
- Dashboard sidebar har et "Settings"-link til `/settings` — den route eksisterer ikke
- `settings/alerts` er kun tilgængelig hvis man kender URL'en

**Krav:**
- Tilføj "Alerts" tab til SiteNav der linker til `/sites/[siteId]/alerts`
- Tilføj "Settings" tab til SiteNav der linker til `/sites/[siteId]/settings/alerts`
- Fjern "Settings"-link fra sidebar (det er site-specifikt, ikke globalt)
- Eller opret global `/settings`-route med user profile (se opgave #37)

---

### ~~31. Forbedre Overview-sidens periode-skifter~~ DONE

**Fil:** `src/app/(dashboard)/sites/[siteId]/overview/page.tsx`

Periode-vælgeren bruger plain `<a>`-tags der forårsager fuld side-reload i stedet for client-side navigation. Derudover mangler device- og land-filtre (API'en understøtter dem).

**Krav:**
- Erstat `<a>` tags med `useRouter` + `searchParams` for client-side navigation
- Tilføj device-filter (All / Mobile / Desktop)
- Tilføj country-filter (top 5 lande baseret på data)
- Vis SEO score på overview-siden (fra `SeoScore`-tabellen)
- Tilføj loading state under data-hentning

---

### ~~32. Forbedre tabeller med konsistent styling~~ DONE

**Filer:** `KeywordsClient.tsx`, `PagesClient.tsx`, `PerfTable.tsx`, `RulesClient.tsx`

Tabeller har inkonsistent styling:
- Nogen bruger raw `<table>` med inline styles
- Pagination bruger raw `<button>` (unthemed) i nogle, shadcn `Button` i andre
- Ingen sorterings-ikoner (kun `aria-hidden` pil-tekst)
- Ingen empty state ("Ingen data fundet")

**Krav:**
- Installer shadcn Table-komponent (`npx shadcn@latest add table`)
- Unificér alle tabeller til shadcn Table
- Konsistent pagination-komponent med Page X af Y
- Sorterings-ikoner (ChevronUp/Down fra Lucide)
- Empty state med illustration/besked
- Responsive: horisontal scroll på mobil (allerede delvist implementeret)

---

### 33. ~~Implementer onboarding-wizard for nye brugere~~ DONE

**Filer:** Nye komponenter + route

Nye brugere ser en tom sites-liste med kun "Connect Your First Site". Der er ingen forklaring af hvad Glimpse er, hvad de kan forvente, eller trin-for-trin guide.

**Krav:**
- Step 1: Velkomstskærm med Glimpse-intro og hvad dashboardet viser
- Step 2: Forbind Google Search Console (eksisterende OAuth flow)
- Step 3: Vælg GSC property og bekræft site
- Step 4: Kør første PSI-test + vis resultat
- Step 5: "Du er klar!" med link til overview
- Stepper/progress-indikator i toppen
- Gem onboarding-status (vis ikke igen efter fuldførelse)

---

### 34. ~~Tilføj data-export (CSV) fra tabeller~~ DONE

**Filer:** `KeywordsClient.tsx`, `PagesClient.tsx`, `PerfTable.tsx`

Brugere kan ikke eksportere data. Keywords, pages og performance-data er kun synlige i UI'et.

**Krav:**
- Tilføj "Eksporter CSV" knap over hver tabel
- Server-side CSV generation via API-route (undgå at hente alle data til klienten)
- Inkluder alle kolonner + filtre i eksporten
- Filnavn: `{siteDomain}-keywords-{date}.csv`
- Tilføj dato-range filter til eksporten

---

### 35. ~~Forbedre toast-systemet~~ DONE

**Fil:** `src/components/ui/toast.tsx`

Det nuværende toast-system har problemer:
- Ingen dismiss-knap (kan ikke lukkes manuelt)
- Ingen animation (instant appear/disappear)
- `Date.now()` som ID kan kollidere ved hurtig succession
- Singleton mønster er skrøbeligt

**Krav:**
- Tilføj X-knap for manuel lukning
- Tilføj fade-in/out animation (CSS transitions eller Framer Motion)
- Brug `crypto.randomUUID()` for IDs
- Tilføj "undo" action-variant (til destructive handlinger)
- Max 3 synlige toasts, stack nye nedefra

---

## Kategori 7: Nye Features

### 36. ~~Implementer keyword position-tracking over tid~~ DONE

**Filer:** Ny API-route, ny chart-komponent, evt. ny tabel

Brugere kan se nuværende keyword-positioner men ikke udvikling over tid. Position-tracking er en kernefunktion i SEO-værktøjer som Morningscore.

**Krav:**
- Ny API-route: `GET /api/sites/[siteId]/gsc/keywords/[keyword]/history?days=90`
- Query `SearchStatDaily` grupperet per dag for specifikt keyword
- Line chart med position, clicks, impressions over tid
- Klikbar fra keyword-tabellen (expand row eller modal)
- Sammenlign med gennemsnitlig position for sitet

---

### ~~37. Opret bruger-profil og notifikations-indstillinger~~ DONE

**Filer:** Ny route `src/app/(dashboard)/settings/`, nye API-routes

Ingen profil-side eller globale indstillinger eksisterer. Brugere kan ikke ændre navn, email-præferencer, eller se deres organization-info.

**Krav:**
- `/settings/profile` — vis/rediger navn, email (via Better Auth)
- `/settings/notifications` — email-præferencer: daglig rapport, ugentlige alerts, crawl-resuméer
- `/settings/organization` — (kun admin/owner) vis org-info, medlemmer, tilføj/fjern brugere
- Gem præferencer i ny `UserPreferences` model (JSON eller relateret tabel)
- Opdater email-udsendelse til at respektere præferencer

---

### ~~38. Implementer sammenligning mellem perioder~~ DONE

**Filer:** Overview-side, keywords-side, nye API-parametre

Brugere kan se data for én periode men ikke sammenligne to perioder (f.eks. denne måned vs. forrige måned). Delta-procenter vises allerede på overview-kort men ikke i detaljer.

**Krav:**
- Tilføj "Sammenlign med" dropdown: Forrige periode, Samme periode sidste år
- Side-by-side tal i KPI-kort (nuværende vs. sammenligning)
- Overlay-linjer på charts (nuværende som solid, sammenligning som stiplet)
- Keyword-tabellen: vis delta-kolonner (position ændring, click ændring)
- API: tilføj `compareStart` og `compareEnd` parametre

---

### ~~39. Implementer site health-score dashboard~~ DONE

**Filer:** Ny komponent, ny API-route

Brugere skal hurtigt kunne se hvilke sites der har problemer. En "health score" der kombinerer performance, crawl-issues, og GSC-trends.

**Krav:**
- Ny API-route: `GET /api/dashboard/health` — aggregerer per site
- Health score baseret på: PSI performance score (40%), aktive alerts (20%), crawl issues (20%), GSC trend (20%)
- Farvekodede site-kort: grøn/gul/rød
- Sortér efter "needs attention" (dårligste først)
- Klikbar til site overview
- Widget på dashboard-landingssiden

---

### ~~40. Implementer konkurrent-sammenligning~~ DONE

**Filer:** Ny model, nye API-routes, ny UI-side

Brugere vil gerne sammenligne deres sites med konkurrenters performance (PSI-scores).

**Krav:**
- Ny model: `Competitor` (siteId, url, name)
- Admin kan tilføje konkurrenter per site (max 5)
- Dagligt PSI-test af konkurrenter (lavere prioritet end egne sites)
- Ny side: `/sites/[siteId]/competitors` — tabel med score-sammenligning
- Bar chart: eget site vs. konkurrenter for LCP, CLS, INP
- Gem historik for trend-sammenligning

---

### ~~41. Implementer automatiske SEO-anbefalinger~~ DONE

**Filer:** Ny `lib/recommendations/` modul, ny UI-komponent

Baseret på indsamlet data (crawl issues, performance metrics, keyword trends) kan systemet generere handlingsanbefalinger.

**Krav:**
- Rule engine der evaluerer data og genererer anbefalinger:
  - LCP > 4s → "Optimer billeder og server-responstid"
  - CLS > 0.25 → "Tilføj width/height til billeder, undgå layout shifts"
  - Position stigning > 20% → "Keyword X mister placering — overvej content-opdatering"
  - Missing meta descriptions (fra crawl) → "Tilføj meta descriptions til X sider"
- Prioriteret liste med severity (kritisk/vigtig/forslag)
- Vis på overview-siden i et "Anbefalinger" panel
- Marker som "ignoreret" eller "løst"

---

### ~~42. Implementer report-historik og scheduling~~ DONE

**Filer:** `src/app/(dashboard)/sites/[siteId]/reports/page.tsx`, ny model

Reports-siden siger "Report history will appear here" — der er ingen historik. Rapporter genereres on-demand.

**Krav:**
- Ny model: `Report` (siteId, type, generatedAt, pdfUrl, sentTo[], status)
- Gem genererede rapporter i object storage (MinIO/S3) eller database (BYTEA)
- Vis historik-tabel: dato, type, status, download-link
- Konfigurérbar scheduling: daglig, ugentlig, månedlig
- Auto-send til org-administratorer baseret på schedule
- "Generer nu" knap der enqueue'er et job

---

### ~~43. Implementer uptime monitoring~~ DONE

**Filer:** Ny kø, ny worker, ny API-route, ny UI-side

Tilføj simpel uptime-monitoring der checker om kunders sites er online.

**Krav:**
- Ny BullMQ kø: `uptime-check` (hvert 5. minut)
- Worker: HTTP HEAD request til site URL, gem status + responstid
- Ny model: `UptimeCheck` (siteId, timestamp, statusCode, responseTimeMs, isUp)
- Ny API-route: `GET /api/sites/[siteId]/uptime?days=30`
- Ny side: `/sites/[siteId]/uptime` — uptime-procent, responstid-graf, incident-log
- Alert integration: send email ved downtime > 5 minutter
- Tilføj til SiteNav

---

### ~~44. Implementer multi-bruger collaboration features~~ DONE

**Filer:** Ny komponent, Better Auth organization udvidelse

Kunder vil gerne dele adgang med deres team (f.eks. webudvikler, content-skriver).

**Krav:**
- Invite-flow: admin/owner kan invitere via email (magic link)
- Roller: Owner (fuld adgang), Admin (næsten fuld), Viewer (kun læse)
- Aktivitets-log: hvem triggererede crawl, hvem ændrede alerts
- Better Auth organizations plugin understøtter allerede roller og invitations
- UI: medlems-liste i org settings, invite-formular, rolle-dropdown

---

### ~~45. Implementer Slack/webhook notifications~~ DONE

**Filer:** Ny model, ny `lib/notifications/` modul

Ikke alle brugere checker email. Slack-integration er standard for monitoring-værktøjer.

**Krav:**
- Ny model: `NotificationChannel` (organizationId, type: EMAIL|SLACK|WEBHOOK, config JSON)
- Slack: incoming webhook URL, kanal-navn
- Webhook: URL + optional headers
- Routing: alerts og rapporter sendes til konfigurerede kanaler
- UI: `/settings/notifications` med kanal-administration
- Test-knap: "Send test-notifikation"

---

## Kategori 8: Testing & Kvalitet

### ~~46. Tilføj E2E tests med Playwright~~ DONE

**Filer:** Ny `playwright.config.ts`, ny `e2e/` mappe

`@playwright/test` er i devDependencies men ingen Playwright-config eller E2E-tests eksisterer.

**Krav:**
- Opret `playwright.config.ts` med localhost:3000 som baseURL
- Seed-script der opretter test-bruger, org, site med mock-data
- E2E tests for:
  - Login flow (magic link mock + Google OAuth mock)
  - Dashboard navigation (sites liste → site overview → keywords → performance)
  - Site connect flow
  - Alert rule CRUD
  - PDF report download
  - Mobile responsive navigation
- CI integration (GitHub Actions)

---

### ~~47. Tilføj tests for uafdækkede kritiske paths~~ DONE

**Filer:** Nye test-filer i `tests/`

Manglende testdækning for:
- `sites/route.ts` GET/POST (multi-tenancy bug)
- `report/route.ts` (ingen auth-test)
- `cron/send-reports` (PDF generation)
- `cron/calculate-scores` idempotency
- `lib/crawler/crawler.ts` (robots.txt, error handling)
- `lib/email/alerts.ts` (email formatting)
- `gsc/callback/route.ts` (token flow)

**Krav:**
- Mindst én test per ovenstående path
- Brug eksisterende mock-mønster fra `tests/api/` og `tests/perf/`
- Test org-boundary violation for alle site-specifikke routes
- Test idempotency for alle cron-endpoints (kald 2x, verificer ingen duplikater)

---

### ~~48. Tilføj CI pipeline med GitHub Actions~~ DONE

**Filer:** `.github/workflows/ci.yml`

Ingen CI/CD pipeline eksisterer. Tests, lint og build køres kun lokalt.

**Krav:**
- Trigger på push til `main` og pull requests
- Steps: checkout → install → lint → type-check (`tsc --noEmit`) → test → build
- PostgreSQL service container for integrationstests
- Cache `node_modules` og `.next/cache`
- Artifact upload af build output
- Fail-fast ved lint-fejl eller test-fejl

---

## Kategori 9: Monitoring & Observability

### ~~49. Tilføj BullBoard admin dashboard~~ DONE

**Filer:** Ny route, ny dependency

`/dashboard/jobs` viser kun basale queue-stats via custom `JobMonitor`-komponent med hardkodede mock-sites. BullBoard giver en komplet admin-UI for BullMQ.

**Krav:**
- Installer `@bull-board/api` + `@bull-board/next`
- Mount under `/admin/queues` (admin-only)
- Vis alle 4+ køer med: aktive/ventende/fejlede/fuldførte jobs
- Mulighed for at retry fejlede jobs, rydde køer, inspicere job data
- Erstat eller supplement den eksisterende `JobMonitor`-komponent
- Auth-guard: kun brugere med `role: ADMIN`

---

### ~~50. Implementer application metrics og dashboard~~ DONE

**Filer:** Ny metrics-modul, Prometheus endpoint eller custom dashboard

Ingen metrics indsamles. Umuligt at vide om systemet er sundt uden at grave i logs.

**Krav:**
- Indsaml metrics:
  - API response times (p50, p95, p99 per route)
  - Queue dybde og gennemløbstid per kø
  - PSI API kald/dag og fejlrate
  - Antal aktive sites, organizations, brugere
  - Crawl-varighed og sider/sekund
  - Database query-tider
- Eksponér via `GET /api/admin/metrics` (admin-only)
- Alternativt: Prometheus-format endpoint til Grafana
- Vis på admin dashboard med Recharts-grafer

---

*50 opgaver i alt — alle fuldført 2026-02-19.*

---
---

# Glimpse — Backlog v2

> 25 prioriterede opgaver: stabilitet, UX-polish, rank tracking, backlinks, konkurrent-intelligence, rapporter og smarte anbefalinger.
> Oprettet: 2026-02-19

---

## Kategori 1: Sikkerhed & Stabilitet

### 1. ~~Fix multi-tenancy-brud i alerts-sider~~ DONE 2026-02-19

**Fil:** `src/app/(dashboard)/sites/[siteId]/alerts/page.tsx`

`alerts/page.tsx` bruger `prisma.site.findUnique({ where: { id: params.siteId } })` uden at checke `organizationId`. Enhver autentificeret bruger der kender et `siteId` kan se andre kunders alert-events.

**Krav:**
- ~~Erstat `findUnique` med `findFirst` der inkluderer `organizationId` fra session~~
- ~~Returner 404 hvis sitet ikke tilhører brugerens aktive organisation~~
- ~~Audit alle andre sider under `sites/[siteId]/` for samme mønster~~
- ~~Tilføj test der verificerer at cross-org access afvises~~

---

### 2. ~~Migrer sidste legacy-læsere til kanoniske modeller~~ DONE 2026-02-19

**Filer:** `src/lib/scoring/seo-scoring.ts`, `src/lib/reports/`, diverse UI-komponenter

Nogle steder læser stadig fra de legacy-tabeller (`SearchConsoleData`, `PerformanceTest`) i stedet for de kanoniske (`SearchStatDaily`, `PerfSnapshot`/`SitePerfDaily`). Legacy-tabeller modtager ikke længere nye data fra sync-pipelinen.

**Krav:**
- ~~Find og erstat alle imports/queries mod `SearchConsoleData` → `SearchStatDaily`~~
- ~~Find og erstat alle imports/queries mod `PerformanceTest` → `PerfSnapshot`/`SitePerfDaily`~~
- ~~Verificer at `SEOCalculator` bruger kanoniske data~~ (brugte allerede kanoniske)
- ~~Verificer at PDF-rapportgeneratoren bruger kanoniske data~~
- ~~Overvej at markere legacy-modeller som `@deprecated` i schema~~ (forældede komponenter og dead code identificeret)

---

### 3. ~~Erstat browser `alert()` med toast-notifikationer~~ DONE 2026-02-19

**Filer:** `src/app/(dashboard)/settings/team/team-client.tsx`, `src/app/(dashboard)/sites/[siteId]/reports/reports-client.tsx` m.fl.

Mindst 6 steder i UI-klienter bruger browser `alert()` til fejlhåndtering i stedet for `@/components/ui/toast` som bruges korrekt andre steder. Giver en inkonsistent og uprofessionel brugeroplevelse.

**Krav:**
- ~~Søg efter alle `alert(` calls i `src/app/` og `src/components/`~~
- ~~Erstat med `toast('error', besked)` eller `toast('success', besked)`~~
- ~~Sikr at toast-provider er mounted i layout~~ (allerede i layout.tsx)

---

## Kategori 2: Keyword & Rank Tracking

### 4. ~~Keyword position-historik UI~~ DONE 2026-02-19

**Filer:** Ny komponent + eksisterende API `GET /api/sites/[siteId]/gsc/keywords/[keyword]/history`

API-endpointet for daglig keyword-historik eksisterer allerede men har ingen UI. Brugere kan ikke se hvordan et keywords position har udviklet sig over tid — en kernefunktion i ethvert SEO-værktøj.

**Krav:**
- Klikbar keyword i keyword-tabellen åbner drilldown-view (slide-over eller separat side)
- Linjechart med daglig position, klik og impressions over tid (Recharts)
- Vis site-gennemsnitlig position som reference-linje
- Vælgbar tidsperiode (7d / 30d / 90d / 365d)
- Vis opsummering: bedste position, gennemsnitlig position, total klik i perioden

---

### 5. ~~Keyword-søgning og avanceret filtrering~~ DONE 2026-02-19

**Fil:** `src/app/(dashboard)/sites/[siteId]/keywords/keywords-client.tsx`

Keywords-listen har device/country/period-filter men mangler fritekst-søgning og avancerede filtreringsmuligheder. Med 100+ keywords er det svært at finde specifikke termer.

**Krav:**
- Fritekst-søgefelt der filtrerer keywords i realtid (client-side for ≤500, server-side for >500)
- Positionsfilter: "Top 3", "Top 10", "Top 20", "50+" som quick-buttons
- CTR-filter: "Lav CTR" (under forventet CTR for positionen)
- Trend-filter: "Kun stigende", "Kun faldende" baseret på positionsændring
- Bevar eksisterende filters (device, country, period)
- Gem filter-state i URL query params så bookmarks virker

---

### 6. ~~Keyword-grupper og tags~~ DONE 2026-02-19

**Filer:** Ny Prisma-model, ny API-route, udvidelse af keywords UI

Brugere har brug for at organisere keywords i grupper (branded, commercial, informational, lokale, osv.) for at forstå deres keyword-strategi.

**Krav:**
- Ny `KeywordTag` model (id, name, color, siteId)
- Ny `KeywordTagAssignment` model (tagId, query, siteId) — many-to-many
- API: CRUD for tags, assign/unassign tags til keywords
- UI: Tag-selector i keyword-tabellen, filter-by-tag, bulk-assign via multi-select
- Foruddefinerede forslag: "Branded", "Commercial", "Informational", "Lokale"

---

### ~~7. Keyword rank change-indikatorer i tabelvisning~~ DONE (2026-02-19)

**Fil:** `src/app/(dashboard)/sites/[siteId]/keywords/keywords-client.tsx`

Keyword-tabellen viser kun nuværende position men ikke ændring siden forrige periode. Brugere kan ikke hurtigt se hvilke keywords der stiger eller falder.

**Krav:**
- Tilføj kolonne "Ændring" med ↑/↓/= ikoner og farvemarkering (grøn/rød/grå)
- Beregn delta mellem nuværende og forrige periodes gennemsnitlige position
- Sortérbar efter ændring (største fald/stigning først)
- Vis tooltip med præcis ændring (f.eks. "+3 positioner")

---

## Kategori 3: Backlink-modul

### ~~8. Backlink data-abstraktionslag og GSC-integration~~ DONE (2026-02-19)

**Filer:** Ny `src/lib/backlinks/`, nye Prisma-modeller, ny BullMQ-queue

Byg et backlink-modul med et provider-interface der starter med GSC Links API (gratis) og kan udvides til Ahrefs/DataForSEO senere.

**Krav:**
- Provider-interface: `BacklinkProvider` med `fetchBacklinks(siteId)`, `fetchReferringDomains(siteId)`
- GSC-provider: Brug Google Search Console Links API (allerede autentificeret via OAuth)
- Prisma-modeller: `BacklinkSnapshot` (dato, total links, total referring domains), `ReferringDomain` (domain, linkCount, firstSeen, lastSeen)
- BullMQ-queue: `backlink-sync` — daglig sync kl. 03:00
- Config: `BACKLINK_PROVIDER=gsc|ahrefs|dataforseo` i env
- Provider-registrering der gør det nemt at tilføje nye providers

---

### 9. Backlink dashboard UI

**Filer:** Ny side `src/app/(dashboard)/sites/[siteId]/backlinks/`, ny API-route

Dashboard-side der viser backlink-data fra det valgte provider-lag.

**Krav:**
- Ny tab "Backlinks" i site-navigationen
- Oversigts-kort: totale links, totale referring domains, trend (↑↓)
- Tabel: Top referring domains med link-count, first seen, type
- Trend-chart: Referring domains over tid (30d/90d)
- Top linkede sider på dit site (hvilke af dine sider får flest links)
- "Nye links" og "Tabte links" sektioner (kræver historik — vises når data er tilgængeligt)

---

## Kategori 4: Konkurrent-intelligence

### 10. Konkurrent keyword-overlap analyse

**Filer:** Ny `src/lib/competitors/keyword-analysis.ts`, ny API-route, ny UI-sektion

Sammenlign dine GSC-keywords med konkurrenters synlige keywords. Kræver at konkurrenter også er GSC-connected (samme org) eller via scraping/API.

**Krav:**
- Analyser keywords der overlapper mellem dit site og en konkurrents site (hvis begge er i Glimpse)
- Vis: Fælles keywords, keywords kun du har, keywords kun konkurrenten har
- Vis positionsforskelle for fælles keywords
- Fallback for eksterne konkurrenter: vis kun dine keywords der matcher konkurrentens domæne i SERP (kræver en position-checker)
- Start simpelt med intern sammenligning (begge sites i Glimpse), udvid senere

---

### 11. Konkurrent rank-sammenligning

**Filer:** Udvidelse af konkurrent-UI, ny API-route

Side-by-side positionsvisning for fælles keywords.

**Krav:**
- Vælg et keyword → vis dit sites position vs. konkurrentens over tid
- Side-by-side linjechart med begge positionskurver
- Tabel med top-10 fælles keywords sorteret efter "biggest gap"
- Kun tilgængelig når begge sites er i Glimpse (intern sammenligning)

---

### 12. Automatisk daglig konkurrent PSI-tracking

**Filer:** Udvidelse af `src/lib/jobs/`, eksisterende konkurrent-model

Konkurrent PSI-tests kører pt. kun on-demand. For at se trends over tid skal de køre automatisk.

**Krav:**
- Tilføj daglig automatisk PSI-test for alle aktive konkurrenter (kl. 04:30, efter site PSI)
- Gem `CompetitorSnapshot` dagligt i stedet for kun ved manuel test
- Vis performance-trend chart på konkurrent-siden (allerede delvist implementeret)
- Respekter PSI daily cap (200 kald/dag) — tæl konkurrent-tests med
- Max 5 konkurrenter × antal sites begrænser den daglige belastning

---

## Kategori 5: UX & Dashboard Polish

### 13. Responsiv tabelvisning til mobil

**Filer:** `keywords-client.tsx`, `pages-client.tsx`, `alerts/page.tsx`, `competitors/`

Tabeller overflower horisontalt på mobil uden scroll-indikator eller alternativ visning.

**Krav:**
- Tilføj responsive card-view for skærmbredder < 768px
- Vis de vigtigste felter (keyword/URL, position, klik) som stacked cards
- Bevar tabel-view for desktop
- Tilføj horisontal scroll-wrapper med fade-indikator som fallback
- Test på iPhone 14 viewport (Playwright mobile project)

---

### 14. Dato-range picker komponent

**Filer:** Ny komponent, opdater overview/keywords/pages/performance

Alle sider bruger faste "7d / 30d / 90d"-knapper. Brugere kan ikke vælge en custom datoperiode.

**Krav:**
- Byg eller installer en date-range picker (shadcn/ui har `Calendar` + `Popover`)
- Bevar quick-buttons (7d, 30d, 90d) som genveje
- Tilføj "Custom" der åbner date picker med fra/til
- Brug URL query params (`?from=2026-01-01&to=2026-01-31`) så det kan bookmarkes
- Implementer på: overview, keywords, pages, performance

---

### 15. Pages-side filtrering og URL-gruppering

**Fil:** `src/app/(dashboard)/sites/[siteId]/pages/pages-client.tsx`

Pages-siden mangler søgning, device/country-filter (som keywords har), og mulighed for at gruppere efter URL-sti.

**Krav:**
- Tilføj fritekst URL-søgning
- Tilføj device og country filter (samme som keywords)
- Tilføj URL-sti gruppering: vis `/blog/` (15 sider), `/products/` (8 sider) osv.
- Klikbar gruppe åbner filtreret visning af sider i den sti
- Vis aggregerede metrics per gruppe (total klik, gns. position)

---

### 16. "Sidst opdateret"-indikator på alle datasider

**Filer:** Ny komponent, diverse sider

Brugere kan ikke se hvornår data sidst blev synkroniseret. Det skaber usikkerhed om datas aktualitet.

**Krav:**
- Ny `DataFreshness` komponent der viser "Sidst opdateret: 19. feb kl. 02:15"
- Hent timestamps fra: seneste `SearchStatDaily.date`, seneste `SitePerfDaily.date`, seneste `CrawlResult.crawlDate`
- Vis på overview-siden og i site-sidebar
- Vis advarsel hvis data er >48 timer gammelt ("Data kan være forældet")

---

### 17. In-browser rapport-preview

**Filer:** Ny komponent, udvidelse af reports-side

Rapporter kan pt. kun downloades som PDF. Brugere vil gerne se indholdet direkte i browseren.

**Krav:**
- Vis rapport-data som HTML direkte i UI (genbruge report-data structure)
- Sektioner: KPI-kort, keyword-tabel, performance-graf, crawl-opsummering
- "Download som PDF" knap der genererer PDF fra samme data
- Responsivt layout der virker på mobil

---

## Kategori 6: Rapporter & White-label

### 18. Customizable rapport-indhold

**Filer:** Udvidelse af rapport-model og PDF-generator

Alle rapporter har pt. samme faste indhold. Brugere bør kunne vælge hvilke sektioner der inkluderes.

**Krav:**
- Tilføj `reportSections` felt på `Report` model (JSON array af sektionsnøgler)
- Tilgængelige sektioner: `kpis`, `keywords`, `pages`, `performance`, `crawl`, `competitors`, `backlinks`
- UI: Checkbox-liste ved rapport-generering og i schedule-settings
- PDF-generator respekterer de valgte sektioner
- Default: alle sektioner inkluderet

---

### 19. White-label rapport-branding

**Filer:** Udvidelse af Organisation-model, PDF-generator

Rapporter bør kunne brandes med kundens eget look-and-feel.

**Krav:**
- Tilføj felter på `Organization`: `brandColor` (hex), `reportHeaderText`, `reportFooterText`
- PDF-generator bruger `brandColor` til overskrifter og accenter
- Vis org-logo (allerede understøttet) + custom header/footer tekst
- Mulighed for at skjule "Genereret af Glimpse"-tekst
- Settings-side under `/settings/branding` til at konfigurere

---

### 20. Automatisk rapport-email med HTML-preview

**Filer:** Udvidelse af `src/app/api/cron/send-reports/route.ts`, ny email-template

Planlagte rapporter genereres men sendes kun som PDF-vedhæftning. Tilføj et HTML-preview i email-body.

**Krav:**
- Byg HTML email-template med top-3 KPIs, vigtigste ændringer, og link til fuld rapport
- Vedhæft PDF som før, men email-body giver et hurtigt overblik
- Brug Resend med React email-templates
- Tilføj email-modtagerliste per rapport (ikke kun site-owner)

---

## Kategori 7: Smarte Anbefalinger & Insights

### 21. Prioriteret anbefalings-dashboard

**Filer:** Ny side, udvidelse af `src/lib/recommendations/engine.ts`

Recommendation-engineen eksisterer men har ingen dedikeret side. Anbefalinger bør være en central del af dashboardet — à la Morningscore "missions".

**Krav:**
- Ny side `/sites/[siteId]/recommendations` i site-navigationen
- Top-10 anbefalinger sorteret efter estimeret impact (høj/medium/lav)
- Hver anbefaling viser: kategori, beskrivelse, berørte sider/keywords, estimeret forbedring
- "Marker som løst" funktion der skjuler anbefalingen til næste crawl/sync
- Refresh-knap der genkører recommendation-engine

---

### 22. Keyword opportunity finder ("Low-hanging fruit")

**Filer:** Ny analyse i `src/lib/recommendations/`, ny UI-sektion

Find keywords med høje impressions men lav CTR i positioner 4-20 — det "lavthængende frugt" der nemmest kan forbedres.

**Krav:**
- Analyser `SearchStatDaily`: keywords med impressions > 50, position mellem 4-20, CTR under forventet for positionen
- Beregn estimeret klik-gevinst hvis positionen forbedres 3 pladser
- Vis som prioriteret liste: keyword, nuværende position, impressions, nuværende CTR, estimeret CTR, potentielle ekstra klik
- Tilgængelig fra recommendations-siden og som widget på overview

---

### 23. Ugentlig SEO health-digest email

**Filer:** Ny cron-route, ny email-template

Automatisk ugentlig opsummering der sendes til site-ejere med de vigtigste ændringer.

**Krav:**
- Ny cron: `send-weekly-digest` (mandag kl. 08:00)
- Indhold: SEO-score ændring, top 3 keyword-bevægelser (op/ned), nye alerts, vigtigste anbefaling
- HTML email via Resend med link til dashboard
- Kan slås til/fra per bruger i notification-settings
- Respekterer notification-channel preferences (email + evt. Slack)

---

## Kategori 8: Teknisk Kvalitet

### 24. Type safety cleanup

**Filer:** Diverse klient-komponenter, API-routes

~150 instanser af `@ts-expect-error`, `@ts-ignore` og `any` i codebasen. Primært i klient-komponenter der modtager utypede props og i API-response handlers.

**Krav:**
- Prioritér klient-komponenter: `KeywordsClient`, `PagesClient`, `PerformanceClient`
- Opret shared types for API-responses (`types/api.ts`)
- Erstat `any` i `getQueueStats` og andre server-utilities med proper BullMQ-types
- Mål: reducer `any`-brug med mindst 75%

---

### 25. Performance-optimering af store queries og client-side debouncing

**Filer:** Export-routes, klient-komponenter med filtre

Keywords/pages export henter op til 10.000 rækker i én query. Filter-ændringer på klient-side trigger øjeblikkelige API-kald uden debouncing.

**Krav:**
- Export-routes: Implementer cursor-baseret pagination eller streaming for store datasets
- Client-side: Tilføj 300ms debounce på søge- og filter-inputs
- Tilføj `loading`-indikator under debounce-perioden
- Overvej server-side caching (1 min TTL) for tunge keyword/page-queries
- Test med 1000+ keywords for at verificere performance

---

*25 opgaver i alt. Prioritér kategori 1 (sikkerhed) og kategori 2 (rank tracking) først.*
