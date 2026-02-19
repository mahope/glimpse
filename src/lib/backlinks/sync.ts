import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { getBacklinkProvider } from './index'
import type { BacklinkCredentials } from './provider'

export type BacklinkSyncOptions = {
  siteId: string
  organizationId: string
}

export async function syncBacklinks(opts: BacklinkSyncOptions) {
  const { siteId, organizationId } = opts

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId, isActive: true },
  })
  if (!site) throw new Error(`Site ${siteId} not found or inactive`)

  const provider = getBacklinkProvider()

  // Build provider-specific credentials
  const creds: BacklinkCredentials = {
    siteUrl: site.gscPropertyUrl || site.url,
    refreshToken: site.gscRefreshToken ? decrypt(site.gscRefreshToken) : undefined,
  }

  const data = await provider.fetchBacklinks(creds)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Upsert snapshot + referring domains in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.backlinkSnapshot.upsert({
      where: {
        siteId_date_provider: { siteId, date: today, provider: provider.name },
      },
      update: {
        totalLinks: data.totalLinks,
        totalReferringDomains: data.totalReferringDomains,
      },
      create: {
        siteId,
        date: today,
        provider: provider.name,
        totalLinks: data.totalLinks,
        totalReferringDomains: data.totalReferringDomains,
      },
    })

    for (const rd of data.referringDomains) {
      await tx.referringDomain.upsert({
        where: {
          siteId_domain_provider: { siteId, domain: rd.domain, provider: provider.name },
        },
        update: {
          linkCount: rd.linkCount,
          lastSeen: today,
        },
        create: {
          siteId,
          domain: rd.domain,
          linkCount: rd.linkCount,
          provider: provider.name,
          firstSeen: today,
          lastSeen: today,
        },
      })
    }
  })

  return {
    provider: provider.name,
    totalLinks: data.totalLinks,
    totalReferringDomains: data.totalReferringDomains,
    domainsUpdated: data.referringDomains.length,
  }
}
