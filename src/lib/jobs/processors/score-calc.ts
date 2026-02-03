import { Job } from 'bullmq'
import { ScoreCalcJob } from '../types'
import { prisma } from '@/lib/db'
import { SEOCalculator } from '@/lib/scoring/calculator'

export default async function scoreCalcProcessor(job: Job<ScoreCalcJob>) {
  const { siteId, organizationId } = job.data
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }

  try {
    const res = await SEOCalculator.calculateSEOScore(siteId)
    // Store latest overall score on Site for quick list views (denormalized)
    await prisma.site.update({ where: { id: siteId }, data: { updatedAt: new Date() } })
    return { ok: true, score: res.overall }
  } catch (err) {
    console.warn('[score-calc] failed', siteId, (err as any)?.message)
    throw err
  }
}
