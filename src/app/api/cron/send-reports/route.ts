import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { sendEmail } from '@/lib/email/client'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

// Basic report settings on Site via Prisma: add columns in a later migration if needed
// For now, pick all active sites and send to organization owners' emails from Member table

export async function POST(req: NextRequest) {
  try {
    const now = new Date()
    const from = startOfMonth(subMonths(now, 1))
    const to = endOfMonth(subMonths(now, 1))
    const periodLabel = `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`

    const sites = await db.site.findMany({
      where: { isActive: true },
      include: {
        organization: { include: { members: { include: { user: true } } } },
        seoScores: { where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' }, take: 1 },
        performanceTests: { orderBy: { createdAt: 'desc' }, take: 1 },
      }
    })

    let sent = 0
    for (const site of sites) {
      // Collect minimal data for v1
      const score = site.seoScores[0]?.score ?? undefined
      const perf = site.performanceTests[0]

      // KPIs mock for now (extend with GSC aggregation later)
      const kpis = [
        { label: 'Clicks', value: 0 },
        { label: 'Impressions', value: 0 },
        { label: 'Avg. Position', value: '-' },
        { label: 'CTR', value: '0%' },
      ]

      const data = {
        site: { id: site.id, name: site.name, domain: site.domain, url: site.url, organization: { name: site.organization.name, logo: site.organization.logo } },
        period: { from: from.toISOString(), to: to.toISOString(), label: periodLabel },
        generatedAt: new Date().toISOString(),
        seoScore: score,
        kpis,
        performance: perf ? {
          lcp: perf.lcp ?? undefined,
          inp: perf.inp ?? undefined,
          cls: perf.cls ?? undefined,
          ttfb: perf.ttfb ?? undefined,
          fcp: perf.fcp ?? undefined,
          speedIndex: perf.speedIndex ?? undefined,
        } : undefined,
      }

      const pdf = await renderReportPDF(data)

      const recipients = site.organization.members
        .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
        .map(m => m.user.email)
        .filter(Boolean) as string[]

      if (!recipients.length) continue

      await sendEmail({
        to: recipients,
        subject: `Glimpse Report: ${site.name} — ${periodLabel}`,
        html: `<p>Your monthly report for <b>${site.name}</b> is attached.</p>` ,
        attachments: [{ filename: `${site.domain}-${format(from, 'yyyy-MM')}.pdf`, content: pdf, contentType: 'application/pdf' }],
      })
      sent++
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
