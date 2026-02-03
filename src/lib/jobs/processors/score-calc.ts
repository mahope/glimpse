import { Job } from 'bullmq'
import { ScoreCalcJob } from '../types'
import { prisma } from '@/lib/db'
import { calculateSeoScore } from '@/lib/scoring/calculator'

export default async function scoreCalcProcessor(job: Job<ScoreCalcJob>) {
  const { siteId, organizationId } = job.data
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }

  try {
    const score = await calculateSeoScore(siteId)
    await prisma.site.update({ where: { id: siteId }, data: { seoScore: score.totalScore, updatedAt: new Date() } })
    return { ok: true, score: score.totalScore }
  } catch (err) {
    console.warn('[score-calc] failed', siteId, (err as any)?.message)
    throw err
  }
}
