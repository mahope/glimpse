import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email/client'
import { subDays } from 'date-fns'
import { verifyCronSecret } from '@/lib/cron/auth'

// Very simple alerting: if latest seoScore dropped > X vs 7d ago, or recent performance failures
// Thresholds will later be configurable per site
const RANK_DROP_THRESHOLD = 15 // points

export async function POST(req: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(req)
    if (unauthorized) return unauthorized

    const since = subDays(new Date(), 7)
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      include: {
        organization: { include: { members: { include: { user: true } } } },
        seoScores: { orderBy: { date: 'desc' }, take: 5 },
        performanceTests: { orderBy: { createdAt: 'desc' }, take: 3 },
      }
    })

    let alerts = 0

    for (const site of sites) {
      const [latest, ...rest] = site.seoScores
      const weekAgo = rest.find(s => s.date < since)
      let messages: string[] = []

      if (latest && weekAgo && latest.score <= weekAgo.score - RANK_DROP_THRESHOLD) {
        messages.push(`SEO score dropped from ${weekAgo.score} to ${latest.score} in the past week.`)
      }

      const failed = site.performanceTests.find(t => t.status === 'FAILED')
      if (failed) {
        messages.push(`Recent performance test failed for ${failed.testUrl}.`)
      }

      if (!messages.length) continue

      const recipients = site.organization.members
        .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
        .map(m => m.user.email)
        .filter(Boolean) as string[]

      if (!recipients.length) continue

      await sendEmail({
        to: recipients,
        subject: `Glimpse Alert: ${site.name}`,
        html: `<p>${messages.join('<br/>')}</p>`
      })
      alerts++
    }

    return NextResponse.json({ ok: true, alerts })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
