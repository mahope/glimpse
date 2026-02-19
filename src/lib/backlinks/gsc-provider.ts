import { logger } from '@/lib/logger'
import type { BacklinkProvider, BacklinkData, BacklinkCredentials, ReferringDomainData } from './provider'

const log = logger.child({ ctx: 'backlink-gsc' })

/**
 * GSC Backlink Provider.
 *
 * NOTE: The Google Search Console API does NOT expose a Links endpoint.
 * The links report visible in the Search Console UI is not available via API.
 * This provider always returns mock data. Replace with a real provider
 * (Ahrefs, DataForSEO, Moz) for production backlink data.
 */
export class GSCBacklinkProvider implements BacklinkProvider {
  name = 'gsc'

  async fetchBacklinks(_creds: BacklinkCredentials): Promise<BacklinkData> {
    log.warn('GSC API does not support backlinks — returning mock data. Set BACKLINK_PROVIDER to a real provider.')
    return this.mockData()
  }

  async fetchReferringDomains(_creds: BacklinkCredentials): Promise<ReferringDomainData[]> {
    log.warn('GSC API does not support backlinks — returning mock data. Set BACKLINK_PROVIDER to a real provider.')
    return this.mockData().referringDomains
  }

  private mockData(): BacklinkData {
    const domains: ReferringDomainData[] = [
      { domain: 'example.com', linkCount: 12 },
      { domain: 'blog.test.dk', linkCount: 8 },
      { domain: 'news.dk', linkCount: 5 },
      { domain: 'forum.example.org', linkCount: 3 },
      { domain: 'directory.io', linkCount: 2 },
    ]
    return {
      totalLinks: domains.reduce((sum, d) => sum + d.linkCount, 0),
      totalReferringDomains: domains.length,
      referringDomains: domains,
    }
  }
}
