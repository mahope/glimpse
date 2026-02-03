import { Job } from 'bullmq'
import { PsiTestJob } from '../types'
import { prisma } from '@/lib/db'
import { runPsi, saveSnapshot, upsertDaily } from '@/lib/perf/psi-service'

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
    const psi = await runPsi(url, device as any)

    // Persist snapshot and daily aggregate (idempotent upsert)
    await saveSnapshot(siteId, psi)
    await upsertDaily(siteId, psi.date)

    await prisma.performanceTest.update({ where: { id: test.id }, data: {
      status: 'COMPLETED',
      score: psi.perfScore ?? null,
      lcp: psi.lcpMs != null ? Math.round(psi.lcpMs) / 1000 : null, // store seconds as schema suggests
      inp: psi.inpMs ?? null,
      cls: psi.cls ?? null,
      ttfb: psi.ttfbMs ?? null,
      lighthouseVersion: psi.raw?.lighthouseResult?.lighthouseVersion ?? null,
      testDuration: null,
    } })
    return { ok: true, score: psi.perfScore ?? null }
  } catch (err: any) {
    await prisma.performanceTest.update({ where: { id: test.id }, data: { status: 'FAILED', errorMessage: err?.message || 'Unknown error' } })
    throw err
  }
}
