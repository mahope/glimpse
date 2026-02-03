import { prisma } from '@/lib/db'
import { PerfDevice, AlertMetric } from '@prisma/client'

async function main() {
  const sites = await prisma.site.findMany({ where: { isActive: true }, select: { id: true } })
  const defaults = [
    { metric: 'LCP' as AlertMetric, device: 'MOBILE' as PerfDevice, threshold: 2500 },
    { metric: 'LCP' as AlertMetric, device: 'DESKTOP' as PerfDevice, threshold: 2000 },
    { metric: 'INP' as AlertMetric, device: 'ALL' as PerfDevice, threshold: 200 },
    { metric: 'CLS' as AlertMetric, device: 'ALL' as PerfDevice, threshold: 0.1 },
    { metric: 'SCORE_DROP' as AlertMetric, device: 'ALL' as PerfDevice, threshold: 10 },
  ]

  for (const s of sites) {
    const existing = await prisma.alertRule.findMany({ where: { siteId: s.id } })
    if (existing.length) continue
    for (const d of defaults) {
      await prisma.alertRule.create({ data: { siteId: s.id, metric: d.metric, device: d.device, threshold: d.threshold, recipients: [] } })
    }
    console.log(`Seeded defaults for site ${s.id}`)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
