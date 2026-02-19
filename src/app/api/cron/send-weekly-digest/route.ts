import { NextRequest, NextResponse } from 'next/server'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron/auth'
import { cronLogger } from '@/lib/logger'
import { sendEmail } from '@/lib/email/client'
import { buildWeeklyDigest } from '@/lib/email/digest-builder'
import { WeeklyDigestEmail } from '@/lib/email/templates'
import { dispatchNotification } from '@/lib/notifications/dispatcher'

const log = cronLogger('send-weekly-digest')

export async function POST(req: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(req)
    if (unauthorized) return unauthorized

    // Find all organizations with active sites
    const orgs = await prisma.organization.findMany({
      where: { sites: { some: { isActive: true } } },
      select: {
        id: true,
        name: true,
        members: { include: { user: true } },
      },
    })

    let sent = 0

    for (const org of orgs) {
      try {
        // Filter recipients: OWNER and ADMIN members who haven't disabled digest
        const recipients = org.members
          .filter(m => {
            if (m.role !== 'OWNER' && m.role !== 'ADMIN') return false
            // Check user notification preferences
            const prefs = m.user.notificationPrefs as Record<string, unknown> | null
            if (prefs && prefs.weeklyDigestEnabled === false) return false
            return true
          })
          .map(m => m.user.email)
          .filter(Boolean) as string[]

        if (!recipients.length) continue

        const digest = await buildWeeklyDigest(org.id)

        // Skip if no sites with data
        if (digest.sites.length === 0) continue

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const dashboardUrl = `${appUrl}/dashboard`

        const markup = renderToStaticMarkup(
          WeeklyDigestEmail({
            organizationName: digest.organizationName,
            periodLabel: digest.periodLabel,
            sites: digest.sites,
            totalAlerts: digest.totalAlerts,
            dashboardUrl,
          })
        )
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:16px;background:#f3f4f6">${markup}</body></html>`

        await sendEmail({
          to: recipients,
          subject: `Glimpse Ugentlig oversigt — ${digest.organizationName}`,
          html,
          text: `Ugentlig SEO-oversigt for ${digest.organizationName} (${digest.periodLabel}). ${digest.totalAlerts} nye alerts. Se dashboard: ${dashboardUrl}`,
        })

        // Also notify via Slack/webhook
        try {
          await dispatchNotification(org.id, {
            event: 'report',
            title: `Ugentlig SEO-oversigt klar`,
            message: `${digest.sites.length} sites, ${digest.totalAlerts} nye alerts denne uge.`,
            severity: 'info',
            url: dashboardUrl,
            fields: digest.sites.slice(0, 3).map(s => ({
              label: s.siteName,
              value: s.seoScore != null ? `Score: ${s.seoScore}${s.seoScoreChange ? ` (${s.seoScoreChange > 0 ? '+' : ''}${s.seoScoreChange})` : ''}` : 'Ingen score',
            })),
          })
        } catch { /* notification dispatch failure should not block digest */ }

        sent++
        log.info({ orgId: org.id, recipientCount: recipients.length }, 'Weekly digest sent')
      } catch (err) {
        log.error({ err, orgId: org.id }, 'Failed to send weekly digest for organization')
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    log.error({ err: e }, 'Send weekly digest cron failed')
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
