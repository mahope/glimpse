import { Job } from 'bullmq'
import { CrawlJob } from '../types'
import { prisma } from '@/lib/db'
import { crawlSite } from '@/lib/crawler/crawler-service'
import { jobLogger } from '@/lib/logger'

export default async function crawlerProcessor(job: Job<CrawlJob>) {
  const { siteId, organizationId, url, maxPages } = job.data
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }

  try {
    const res = await crawlSite({ startUrl: url, maxPages: maxPages ?? 50 })
    // Optionally persist summary on site model
    await prisma.site.update({ where: { id: siteId }, data: { lastCrawledAt: new Date() } })
    return { ok: true, pages: res?.pagesVisited ?? 0 }
  } catch (err) {
    const log = jobLogger('site-crawl', job.id, { siteId })
    log.warn({ siteId, err }, 'Crawler failed')
    throw err
  }
}
