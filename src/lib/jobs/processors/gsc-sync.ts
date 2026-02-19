import { Job } from 'bullmq'
import { GSCSyncJob } from '../types'
import { prisma } from '@/lib/db'
import { fetchAndStoreGSCDaily } from '@/lib/gsc/fetch-daily'
import { jobLogger } from '@/lib/logger'

export default async function gscSyncProcessor(job: Job<GSCSyncJob>) {
  const data = job.data
  // Validate ownership and site status
  const site = await prisma.site.findFirst({ where: { id: data.siteId, organizationId: data.organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }
  if (!site.gscPropertyUrl || !site.gscRefreshToken) {
    const log = jobLogger('gsc-sync', job.id, { siteId: site.id })
    log.warn({ siteId: site.id }, 'GSC not configured for site')
    return { skipped: true, reason: 'gsc_not_configured' }
  }

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 30)
  try {
    const res = await fetchAndStoreGSCDaily({
      siteId: site.id,
      propertyUrl: site.gscPropertyUrl,
      refreshToken: site.gscRefreshToken,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      mock: process.env.MOCK_GSC === 'true',
    })
    return { ok: true, processed: res.recordsProcessed }
  } catch (err: unknown) {
    const log = jobLogger('gsc-sync', job.id, { siteId: site.id })
    log.warn({ siteId: site.id, err }, 'GSC sync failed')
    throw err
  }
}
