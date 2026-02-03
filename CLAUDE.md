# Glimpse - CLAUDE.md

> Dette dokument guider AI-assistenter (primært Claude) i hvordan de skal arbejde med dette projekt.

## Projekt Oversigt

SEO Tracker er et internt SEO dashboard til mahope.dk's WordPress-kunder. Det trækker data fra Google Search Console og kører hastighedstest via PageSpeed Insights API.

**Ejer:** Mads (mahope.dk)  
**Formål:** Erstatte dyre SaaS-værktøjer som Morningscore  
**Brugere:** ~25 WordPress-kunder + admin  
**Multi-site:** Hver kunde kan have flere sites

## Tech Stack (Januar 2026 - Nyeste Versioner)

| Kategori | Teknologi | Version | Notes |
|----------|-----------|---------|-------|
| Framework | **Next.js** | **16.1+** | Turbopack stable, proxy.ts, Cache Components |
| UI Library | React | 19+ | Server Components, use() hook |
| **Auth** | **Better Auth** | **1.x** | **Auth.js teamet joined Better Auth sep 2025** |
| Database | PostgreSQL | 17+ | Via Prisma |
| ORM | Prisma | 6.2+ | Type-safe, Better Auth adapter |
| Styling | Tailwind CSS | 4.0+ | Oxide engine |
| Components | shadcn/ui | latest | Customizable |
| Charts | Recharts | 2.15+ | React-native |
| Data Fetching | TanStack Query | 5.62+ | Caching |
| Cache/Queue | Redis + BullMQ | 7.4+ | Background jobs |

**VIGTIGT:** Auth.js/NextAuth.js er nu en del af Better Auth. Brug Better Auth til nye projekter.

## Next.js 16 Specifikt

### Nye Features
1. **Turbopack** - Stable og default, 2-5x hurtigere builds
2. **proxy.ts** - Erstatter middleware.ts (network boundary)
3. **Cache Components** - `'use cache'` directive
4. **DevTools MCP** - AI-assisted debugging
5. **File System Caching** - Hurtigere startup

### proxy.ts vs middleware.ts
```typescript
// FØR (Next.js 15): middleware.ts
export function middleware(request: NextRequest) { ... }

// NU (Next.js 16): proxy.ts
export async function proxy(request: Request) { ... }
```

## Better Auth Setup

### Hvorfor Better Auth?
- Auth.js/NextAuth teamet er officielt en del af Better Auth (september 2025)
- TypeScript-first med fuld type safety
- Built-in plugins: magic link, organizations, OAuth
- Nem integration med Prisma
- Fungerer perfekt med Next.js 16

### Server Config (lib/auth.ts)
```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    nextCookies(),
    magicLink({ sendMagicLink: async ({ email, url }) => { /* Resend */ } }),
    organization({ allowUserToCreateOrganization: false }),
  ],
  socialProviders: {
    google: { clientId: "...", clientSecret: "..." },
  },
});
```

### Client Config (lib/auth-client.ts)
```typescript
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [magicLinkClient(), organizationClient()],
});

export const { signIn, signOut, useSession, organization } = authClient;
```

### API Route (app/api/auth/[...all]/route.ts)
```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### proxy.ts Auth Protection
```typescript
// proxy.ts
import { betterFetch } from "@better-fetch/fetch";

const protectedRoutes = ["/dashboard", "/sites", "/admin"];

export async function proxy(request: Request) {
  const url = new URL(request.url);
  
  if (!protectedRoutes.some(r => url.pathname.startsWith(r))) {
    return; // Not protected
  }
  
  const { data: session } = await betterFetch("/api/auth/get-session", {
    baseURL: url.origin,
    headers: { cookie: request.headers.get("cookie") || "" },
  });
  
  if (!session) {
    return Response.redirect(new URL("/auth/sign-in", url.origin));
  }
}
```

## Mappestruktur

```
seo-dashboard/
├── proxy.ts                        # Next.js 16 auth protection
├── prisma/
│   └── schema.prisma               # Inkl. Better Auth tables
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── sign-in/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── sites/[siteId]/
│   │   │       ├── page.tsx
│   │   │       └── performance/
│   │   └── api/
│   │       ├── auth/[...all]/route.ts   # Better Auth
│   │       ├── sites/
│   │       └── cron/
│   ├── components/
│   │   ├── ui/
│   │   ├── auth/                   # Sign in form, user menu
│   │   ├── charts/
│   │   └── layout/
│   │       └── SiteSelector.tsx
│   ├── lib/
│   │   ├── auth.ts                 # Better Auth server
│   │   ├── auth-client.ts          # Better Auth client
│   │   ├── db.ts
│   │   ├── performance/
│   │   └── gsc/
│   └── hooks/
│       ├── useSession.ts
│       └── useOrganization.ts
└── CLAUDE.md
```

## Core Concepts

### Multi-Site per Kunde (via Organizations)
```
Organization (Better Auth)
└── Sites[] (1:N relation via organizationId)
    ├── Site A (example.com)
    ├── Site B (shop.example.com)
    └── Site C (blog.example.com)
```

- Brug `session.session.activeOrganizationId` for aktiv org
- Sites filtreres altid på organizationId
- Admin kan se alle organizations

### Session i Server Components
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  const orgId = session?.session.activeOrganizationId;
  // Fetch sites for this org
}
```

## Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Better Auth
BETTER_AUTH_SECRET="random-32-char-string"

# Google (OAuth + PageSpeed)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_PAGESPEED_API_KEY="..."  # Optional

# Encryption (for GSC tokens)
ENCRYPTION_KEY="64-char-hex"

# Email
RESEND_API_KEY="re_..."

# Cron
CRON_SECRET="..."
```

## Kodekonventioner

### Generelt
- **TypeScript** altid - ingen `any`
- **Named exports** - ikke default
- Filer: kebab-case (`site-selector.tsx`)
- Komponenter: PascalCase (`SiteSelector`)

### React/Next.js 16
- **Server Components** som default
- `'use client'` kun når nødvendigt
- Brug **proxy.ts** til auth (ikke middleware)
- Brug `'use cache'` for caching

### Better Auth
- Server: `auth.api.getSession({ headers })`
- Client: `useSession()` hook
- Organizations: `session.session.activeOrganizationId`

### Database
- Alle queries via Prisma
- Verificer **altid** organizationId
- Kryptér GSC tokens

## Vigtige Filer

| Fil | Formål |
|-----|--------|
| `proxy.ts` | Auth protection (Next.js 16) |
| `lib/auth.ts` | Better Auth server config |
| `lib/auth-client.ts` | Better Auth client config |
| `app/api/auth/[...all]/route.ts` | Better Auth handler |
| `prisma/schema.prisma` | Database + Better Auth tables |
| `lib/performance/thresholds.ts` | Core Web Vitals thresholds |

## Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

Farver: Grøn `#0cce6b`, Orange `#ffa400`, Rød `#ff4e42`

## Background Jobs

| Job | Schedule | Beskrivelse |
|-----|----------|-------------|
| sync-gsc | 02:00 dagligt | Sync GSC data |
| performance-test | 04:00 dagligt | PageSpeed test |
| crawl-site | 05:00 søndag | Crawl for issues |
| calculate-scores | 06:00 dagligt | Beregn SEO scores |

## Almindelige Tasks

### Tilføj ny bruger til organization
```typescript
// Better Auth organization plugin
await auth.api.organization.addMember({
  organizationId: "org_123",
  userId: "user_456",
  role: "member",
});
```

### Hent sites for brugerens org
```typescript
const session = await auth.api.getSession({ headers: await headers() });
const sites = await prisma.site.findMany({
  where: { organizationId: session.session.activeOrganizationId },
});
```

### Kør manuel performance test
```bash
curl -X POST http://localhost:3000/api/sites/{siteId}/performance/test \
  -H "Cookie: better-auth.session_token=..."
```

## Debugging Tips

### Better Auth session er null
1. Tjek `BETTER_AUTH_SECRET` er sat
2. Tjek cookie sendes med request
3. Tjek database har session record

### proxy.ts redirect loop
1. Auth routes (`/auth/*`) må IKKE være protected
2. Tjek protectedRoutes array

### Organization data mangler
1. Tjek `activeOrganizationId` i session
2. Tjek Member relation findes
3. Brug `organization.setActive()` client-side

### Next.js 16 migration issues
1. Omdøb `middleware.ts` → `proxy.ts`
2. Omdøb exported function → `proxy`
3. proxy.ts kører på Node.js runtime (ikke Edge)

## Testing

```bash
npm run test              # Unit + integration (Vitest)
npm run test:e2e          # E2E (Playwright)
```

Kritiske tests:
- Better Auth sign in flow
- Organization membership
- Site ownership verification
- Performance thresholds

## Sikkerhed

### Multi-tenant Isolation
```typescript
// ALTID verificer ownership
const site = await prisma.site.findFirst({
  where: {
    id: siteId,
    organizationId: session.session.activeOrganizationId, // KRITISK
  },
});
```

### Better Auth Security
- Secure cookies (httpOnly, sameSite, secure)
- Built-in CSRF protection
- Session expiration og rotation
- Rate limiting på auth endpoints

## Links

- [Next.js 16.1 Blog](https://nextjs.org/blog/next-16-1)
- [Better Auth Docs](https://www.better-auth.com/docs)
- [Better Auth + Next.js](https://www.better-auth.com/docs/integrations/next)
- [Auth.js joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth)
- [PageSpeed API](https://developers.google.com/speed/docs/insights/v5/get-started)

---

*Sidst opdateret: Januar 2026*