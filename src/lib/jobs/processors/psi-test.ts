import { Job } from 'bullmq'
import { PsiTestJob } from '../types'
import { prisma } from '@/lib/db'
import { runPsi, saveSnapshot, upsertDaily } from '@/lib/perf/psi-service'

export default async function psiTestProcessor(job: Job<PsiTestJob>) {
  const { siteId, organizationId, url, device } = job.data

  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true } })
  if (!site) return { skipped: true, reason: 'site_not_found_or_denied' }

  // Idempotency: avoid duplicate snapshots for same site+strategy within 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const existing = await prisma.perfSnapshot.findFirst({
    where: { siteId, strategy: device, date: { gte: oneHourAgo } },
  })
  if (existing) return { skipped: true, reason: 'recent_snapshot_exists' }

  const psi = await runPsi(url, device as any)

  // Persist snapshot and daily aggregate (idempotent upsert)
  await saveSnapshot(siteId, psi)
  await upsertDaily(siteId, psi.date, device as any)

  return { ok: true, score: psi.perfScore ?? null }
}
