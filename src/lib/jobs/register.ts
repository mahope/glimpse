import { prisma } from '@/lib/db'
import { gscSyncQueue, performanceQueue, crawlQueue, scoreQueue, uptimeCheckQueue } from './queue'

async function ensureRepeatable(queue: any, name: string, data: any, repeat: { cron: string }, jobId: string) {
  const existing = await queue.getRepeatableJobs()
  const exists = existing.some((j: any) => j.name === name && j.id === jobId)
  if (!exists) {
    await queue.add(name, data, { repeat, jobId })
  }
}

export async function registerRepeatableJobsForSite(site: { id: string; organizationId: string; url: string }) {
  const { id: siteId, organizationId, url } = site
  await Promise.all([
    ensureRepeatable(gscSyncQueue, 'sync-gsc-data', { siteId, organizationId }, { cron: '0 2 * * *' }, `gsc:${siteId}`),
    ensureRepeatable(performanceQueue, 'test-performance:mobile', { siteId, organizationId, url, device: 'MOBILE' }, { cron: '0 4 * * *' }, `perf:mobile:${siteId}`),
    ensureRepeatable(performanceQueue, 'test-performance:desktop', { siteId, organizationId, url, device: 'DESKTOP' }, { cron: '5 4 * * *' }, `perf:desktop:${siteId}`),
    ensureRepeatable(crawlQueue, 'crawl-site', { siteId, organizationId, url, maxPages: 50 }, { cron: '0 5 * * 0' }, `crawl:${siteId}`),
    ensureRepeatable(scoreQueue, 'calculate-scores', { siteId, organizationId }, { cron: '0 6 * * *' }, `score:${siteId}`),
    ensureRepeatable(uptimeCheckQueue, 'check-uptime', { siteId, organizationId, url }, { cron: '*/5 * * * *' }, `uptime:${siteId}`),
  ])
}

export async function registerRepeatableJobsForAllSites() {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, organizationId: true, url: true },
  })
  for (const site of sites) {
    await registerRepeatableJobsForSite(site)
  }
  return sites.length
}
