import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { buildReportData } from '@/lib/reports/build-report-data'
import { sendEmail } from '@/lib/email/client'
import { dispatchNotification } from '@/lib/notifications/dispatcher'
import { format } from 'date-fns'
import { verifyCronSecret } from '@/lib/cron/auth'
import { cronLogger } from '@/lib/logger'
import type { ReportSchedule } from '@prisma/client'
import type { ReportSectionKey } from '@/lib/reports/types'

const log = cronLogger('send-reports')

export async function POST(req: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(req)
    if (unauthorized) return unauthorized

    // Determine which schedules to process based on current date
    const now = new Date()
    const scheduleFilter: ReportSchedule[] = ['WEEKLY']
    if (now.getDate() === 1) {
      scheduleFilter.push('MONTHLY')
    }

    const sites = await prisma.site.findMany({
      where: {
        isActive: true,
        reportSchedule: { in: scheduleFilter },
      },
      include: {
        organization: { include: { members: { include: { user: true } } } },
      },
    })

    let sent = 0
    for (const site of sites) {
      try {
        const sections = Array.isArray(site.reportSections) ? site.reportSections as ReportSectionKey[] : undefined
        const data = await buildReportData(site, sections)
        const pdf = await renderReportPDF(data)
        const typeLabel = site.reportSchedule === 'WEEKLY' ? 'weekly' : 'monthly'
        const fileName = `${site.domain}-${format(now, 'yyyy-MM-dd')}.pdf`

        const recipients = site.organization.members
          .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
          .map(m => m.user.email)
          .filter(Boolean) as string[]

        if (!recipients.length) continue

        // Store report before sending email so it's preserved even if email fails
        const report = await prisma.report.create({
          data: {
            siteId: site.id,
            type: typeLabel,
            status: 'completed',
            fileName,
            pdfData: Buffer.from(pdf),
            sentTo: [],
          },
        })

        try {
          await sendEmail({
            to: recipients,
            subject: `Glimpse Rapport: ${site.name} — ${data.period.label}`,
            html: `<p>Din ${typeLabel === 'weekly' ? 'ugentlige' : 'månedlige'} rapport for <b>${site.name}</b> er vedhæftet.</p>`,
            attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
          })

          await prisma.report.update({
            where: { id: report.id },
            data: { sentTo: recipients },
          })

          // Notify Slack/webhook channels
          try {
            await dispatchNotification(site.organizationId, {
              event: 'report',
              title: `Rapport klar: ${site.name}`,
              message: `${typeLabel === 'weekly' ? 'Ugentlig' : 'Månedlig'} rapport for ${site.name} er genereret og sendt.`,
              severity: 'info',
              url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/sites/${site.id}/reports`,
              fields: [
                { label: 'Site', value: site.name },
                { label: 'Type', value: typeLabel === 'weekly' ? 'Ugentlig' : 'Månedlig' },
                { label: 'Periode', value: data.period.label },
              ],
            })
          } catch { /* notification dispatch failure should not block reports */ }

          sent++
        } catch (emailErr) {
          await prisma.report.update({
            where: { id: report.id },
            data: { status: 'failed' },
          })
          log.error({ err: emailErr, siteId: site.id }, 'Failed to email report')
        }
      } catch (err) {
        log.error({ err, siteId: site.id }, 'Failed to generate report for site')
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    log.error({ err: e }, 'Send reports cron failed')
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
