import { prisma } from '@/lib/db'

export function extractDomain(url: string): string {
  try {
    return new URL(url.replace(/\/+$/, '')).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export async function findMatchedSite(
  competitorUrl: string,
  organizationId: string,
  excludeSiteId: string,
) {
  const domain = extractDomain(competitorUrl)
  if (!domain) return null

  return prisma.site.findFirst({
    where: {
      organizationId,
      id: { not: excludeSiteId },
      OR: [
        { domain },
        { domain: `www.${domain}` },
        { url: { startsWith: `https://${domain}` } },
        { url: { startsWith: `https://www.${domain}` } },
        { url: { startsWith: `http://${domain}` } },
      ],
    },
  })
}
