import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron/auth'
import { addDays, subDays, isAfter } from 'date-fns'
import { AlertMetric, AlertStatus, PerfDevice } from '@prisma/client'
import { evaluateRule, SeriesPoint } from '@/lib/alerts'
import { sendAlertEmail } from '@/lib/email/alerts'

export async function POST(req: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(req)
    if (unauthorized) return unauthorized

    // Load active sites and rules
    const sites = await prisma.site.findMany({ where: { isActive: true } })
    const siteIds = sites.map(s => s.id)

    const rules = await prisma.alertRule.findMany({ where: { siteId: { in: siteIds }, enabled: true } })

    // For each site, pull last 2 days of SitePerfDaily for all devices
    const since = subDays(new Date(), 2)
    const perf = await prisma.sitePerfDaily.findMany({
      where: { siteId: { in: siteIds }, date: { gte: since } },
      orderBy: { date: 'asc' },
    })

    // Group by site
    const bySite = new Map<string, SeriesPoint[]>()
    for (const p of perf) {
      const arr = bySite.get(p.siteId) ?? []
      arr.push({
        date: p.date,
        device: p.device,
        lcpPctl: p.lcpPctl,
        inpPctl: p.inpPctl,
        clsPctl: p.clsPctl,
        perfScoreAvg: p.perfScoreAvg,
      })
      bySite.set(p.siteId, arr)
    }

    const results: any[] = []

    for (const rule of rules) {
      const series = bySite.get(rule.siteId) ?? []
      const evalRes = evaluateRule(rule.metric, rule.threshold, rule.device, series)

      // Debounce: if an OPEN event exists within last 24h for same tuple, do not create new
      const openRecent = await prisma.alertEvent.findFirst({
        where: {
          siteId: rule.siteId,
          metric: rule.metric,
          device: rule.device,
          status: 'OPEN',
          // Debounce by event date to keep tests offline (no DB default timestamps)
          date: { gte: subDays(new Date(), 1) },
        },
      })

      if (evalRes.violated) {
        if (!openRecent) {
          const latestDate = series.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.date ?? new Date()
          const event = await prisma.alertEvent.create({
            data: {
              siteId: rule.siteId,
              metric: rule.metric,
              device: rule.device,
              date: latestDate,
              value: evalRes.value ?? 0,
              ruleId: rule.id,
              status: 'OPEN',
            },
          })

          // Send email
          const site = sites.find(s => s.id === rule.siteId)!
          await sendAlertEmail(site, rule, event)
          results.push({ ruleId: rule.id, created: event.id })
        } else {
          results.push({ ruleId: rule.id, skipped: 'open-recent' })
        }
      } else {
        // If condition cleared next day, resolve any open events
        const opens = await prisma.alertEvent.findMany({
          where: { siteId: rule.siteId, metric: rule.metric, device: rule.device, status: 'OPEN' },
        })
        for (const ev of opens) {
          // Resolve if the latest evaluated date is after event.date
          const latestDate = series.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.date
          if (latestDate && isAfter(latestDate, ev.date)) {
            await prisma.alertEvent.update({
              where: { id: ev.id },
              data: { status: 'RESOLVED', resolvedAt: new Date() },
            })
            results.push({ ruleId: rule.id, resolved: ev.id })
          }
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
