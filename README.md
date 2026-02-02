# Glimpse

A comprehensive SEO dashboard for tracking WordPress site performance via Google Search Console and PageSpeed Insights.

## Features

- 📊 **Dashboard Analytics** - KPI cards, trending charts, top keywords & pages
- 🔍 **Google Search Console Integration** - Automated data sync for clicks, impressions, CTR, and positions
- ⚡ **Performance Monitoring** - Core Web Vitals tracking via PageSpeed Insights API (daily via BullMQ queue perf:fetch)
- 🏢 **Multi-tenant** - Organization-based site management via Better Auth
- 📧 **Magic Link Authentication** - Passwordless login with email
- 🎯 **SEO Scoring** - Calculated scores based on multiple performance factors
- 📈 **Historical Data** - Long-term tracking and trend analysis

## Tech Stack

- **Framework**: Next.js 16.1+ with App Router, Turbopack
- **Auth**: Better Auth 1.x with magic link & organization plugins
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Tailwind CSS 4.0+ with shadcn/ui components
- **Charts**: Recharts for data visualization
- **API Integration**: Google Search Console & PageSpeed Insights
- **Caching**: Redis with BullMQ for background jobs

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis (optional, for caching)
- Google OAuth credentials
- Resend account (for magic link emails)

### 1. Clone and Install

```bash
git clone <repository-url>
cd glimpse
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/glimpse"

# Better Auth
BETTER_AUTH_SECRET="your-32-character-secret-key-here"

# Google OAuth (for Search Console access)
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Email (Resend for magic links)
RESEND_API_KEY="re_your-resend-api-key"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations (recommended)
npm run db:migrate

# Open Prisma Studio (optional)
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Project Structure

```
glimpse/
├── proxy.ts                           # Next.js 16 auth protection
├── src/
│   ├── app/
│   │   ├── (auth)/                     # Authentication pages
│   │   ├── (dashboard)/                # Protected dashboard pages
│   │   └── api/                        # API routes
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── auth/                       # Auth-related components
│   │   ├── charts/                     # Chart components (Recharts)
│   │   ├── dashboard/                  # Dashboard-specific components
│   │   └── layout/                     # Layout components
│   ├── lib/
│   │   ├── auth.ts                     # Better Auth server config
│   │   ├── auth-client.ts              # Better Auth client config
│   │   ├── db.ts                       # Prisma client
│   │   ├── performance/                # PageSpeed & performance utilities
│   │   └── gsc/                        # Google Search Console utilities
│   └── hooks/                          # React hooks
├── prisma/
│   └── schema.prisma                   # Database schema
└── CLAUDE.md                          # Development guidelines
```

## Key Components

### Authentication (Better Auth)

- **Magic Link Login**: Passwordless authentication via email
- **Organization Support**: Multi-tenant with organization-based access control
- **Google OAuth**: For Search Console API access
- **Session Management**: Secure session handling with proxy.ts protection

### Performance Monitoring

- **Core Web Vitals**: LCP, INP, CLS, TTFB tracking
- **Mobile & Desktop**: Separate testing for both device types
- **Historical Data**: Performance trends over time
- **Automated Testing**: Daily performance tests via cron jobs

### Search Console Integration

- **OAuth Flow**: Secure connection to user's GSC account
- **Data Sync**: Daily import of search performance data
- **Multi-site Support**: Track multiple domains per organization
- **Encrypted Storage**: Secure storage of refresh tokens

## API Routes

### Core Routes

- `GET /api/sites` - List organization sites
- `POST /api/sites` - Create new site

### Performance

- `GET /api/sites/[siteId]/perf/latest?strategy=mobile|desktop&page=1&pageSize=50` — Latest PSI snapshot per URL for the site/strategy. Includes pagination totals.
- `GET /api/sites/[siteId]/perf/daily?days=30` — Aggregated daily CWV percentiles (p75) and average Lighthouse perf score from SitePerfDaily.

Both routes are organization-scoped and require an authenticated session.

### Cron Jobs

- `POST /api/cron/gsc-refresh?siteId=&days=30` — Fetch per-day rows from GSC and upsert SearchStatDaily (secured via Authorization: Bearer ${CRON_SECRET})
- `POST /api/cron/perf-refresh` - Enqueue PSI fetches per site (supports ?siteId and ?limit). Secured via Authorization: Bearer ${CRON_SECRET}
- `POST /api/cron/calculate-scores` - Calculate SEO scores

### GSC Aggregation Routes

- `GET /api/sites/[siteId]/gsc/keywords?days=30&page=1&pageSize=50&device=all&country=all` — Aggregated KeywordSummary-like response from SearchStatDaily
- `GET /api/sites/[siteId]/gsc/pages?days=30&page=1&pageSize=50` — Aggregated PageSummary-like response from SearchStatDaily

## Database Schema

Key entities:

- **User** - Authentication and user management
- **Organization** - Multi-tenant organization structure
- **Site** - Tracked websites with GSC connection
- **SearchConsoleData** - Historical GSC metrics
- **PerformanceTest** - PageSpeed test results
- **SeoScore** - Calculated SEO scores

## Deployment

### Environment Variables

Ensure all production environment variables are set:

- Database connection
- Better Auth secret (32+ characters)
- Google OAuth credentials
- Email service (Resend) API key
- Cron secret for webhook protection

### Database Migration

```bash
npm run db:migrate
```

### Build and Deploy

```bash
npm run build
npm start
```

## Development

### Code Conventions

- **TypeScript everywhere** - No `any` types
- **Named exports** - Prefer named over default exports
- **Server Components** - Use Server Components by default
- **File naming** - kebab-case for files, PascalCase for components

### Adding New Features

1. Update Prisma schema if needed
2. Generate Prisma client: `npm run db:push`
3. Create API routes following existing patterns
4. Build UI components with shadcn/ui
5. Add proper TypeScript types

## Troubleshooting

### Common Issues

1. **Better Auth session is null**
   - Check `BETTER_AUTH_SECRET` is set
   - Verify database has session records
   - Check cookie configuration

2. **proxy.ts redirect loop**
   - Ensure auth routes (`/auth/*`) are not protected
   - Check `protectedRoutes` array in proxy.ts

3. **Google API errors**
   - Verify OAuth credentials are correct
   - Check API quotas and rate limits
   - Ensure proper scopes are requested

## Contributing

1. Follow the existing code style and patterns
2. Update CLAUDE.md for architectural decisions
3. Add tests for new functionality
4. Ensure TypeScript strict mode compliance

## License

Private project for mahope.dk WordPress customers.

---

For detailed development guidelines, see [CLAUDE.md](./CLAUDE.md).