import { Job } from 'bullmq'
import { PsiTestJob } from '../types'
import { prisma } from '@/lib/db'
import { runPageSpeedTest } from '@/lib/performance/pagespeed-client'

export default async function psiTestProcessor(job: Job<PsiTestJob>) {
  const { siteId, organizationId, url, device } = job.data

  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }

  // Idempotency: avoid duplicate running tests for same site+device within 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const existing = await prisma.performanceTest.findFirst({ where: { siteId, device, createdAt: { gte: oneHourAgo }, status: 'RUNNING' } })
  if (existing) return { skipped: true, reason: 'recent_running' }

  // Create RUNNING record
  const test = await prisma.performanceTest.create({ data: { siteId, testUrl: url, device, status: 'RUNNING' } })

  try {
    const res = await runPageSpeedTest(url, { device: device.toLowerCase() as 'mobile' | 'desktop', categories: ['performance'] })
    await prisma.performanceTest.update({ where: { id: test.id }, data: {
      status: 'COMPLETED', score: res.score,
      lcp: res.metrics.lcp, inp: res.metrics.inp, cls: res.metrics.cls,
      ttfb: res.metrics.ttfb, fcp: res.metrics.fcp, speedIndex: res.metrics.speedIndex,
      lighthouseVersion: res.lighthouseVersion, testDuration: res.testDuration,
    } })
    return { ok: true, score: res.score }
  } catch (err: any) {
    await prisma.performanceTest.update({ where: { id: test.id }, data: { status: 'FAILED', errorMessage: err?.message || 'Unknown error' } })
    throw err
  }
}
