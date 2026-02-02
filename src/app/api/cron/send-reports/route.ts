import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { sendEmail } from '@/lib/email/client'
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from 'date-fns'
import { verifyCronSecret } from '@/lib/cron/auth'

export async function POST(req: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(req)
    if (unauthorized) return unauthorized

    const now = new Date()
    const from = startOfMonth(subMonths(now, 1))
    const to = endOfMonth(subMonths(now, 1))
    const periodLabel = `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`

    const sites = await prisma.site.findMany({
      where: { isActive: true },
      include: {
        organization: { include: { members: { include: { user: true } } } },
        seoScores: { where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' }, take: 1 },
        performanceTests: { orderBy: { createdAt: 'desc' }, take: 1 },
        searchConsoleData: { where: { date: { gte: from, lte: to } }, orderBy: { date: 'asc' } },
      }
    })

    let sent = 0
    for (const site of sites) {
      const score = site.seoScores[0]?.score ?? undefined
      const perf = site.performanceTests[0]

      // Aggregate GSC KPIs for the month
      const totals = site.searchConsoleData.reduce((acc, r) => {
        acc.clicks += r.clicks
        acc.impressions += r.impressions
        acc.ctr += r.ctr
        acc.position += r.position
        acc.n += 1
        return acc
      }, { clicks: 0, impressions: 0, ctr: 0, position: 0, n: 0 })

      const kpis = [
        { label: 'Clicks', value: totals.clicks },
        { label: 'Impressions', value: totals.impressions },
        { label: 'Avg. Position', value: totals.n ? (totals.position / totals.n).toFixed(1) : '-' },
        { label: 'CTR', value: totals.n ? `${((totals.ctr / totals.n) * 100).toFixed(1)}%` : '-' },
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

      // Simple text summary
      const summaryText = `Site: ${site.name} (${site.domain})\nScore: ${score ?? 'N/A'}\nClicks: ${totals.clicks}, Impressions: ${totals.impressions}, Avg Pos: ${kpis[2].value}, CTR: ${kpis[3].value}`

      await sendEmail({
        to: recipients,
        subject: `Glimpse Report: ${site.name} — ${periodLabel}`,
        html: `<p>Your monthly report for <b>${site.name}</b> is attached.</p><p><b>Summary:</b><br/>${summaryText.replace(/\n/g, '<br/>')}</p>` ,
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
