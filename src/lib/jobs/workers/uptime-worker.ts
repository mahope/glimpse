import { Worker, Job } from 'bullmq'
import { redisConnection, UptimeCheckJobData } from '../queue'
import { prisma } from '@/lib/db'
import { jobLogger } from '@/lib/logger'
import { moveToDeadLetter } from '../dead-letter'
import { sendEmail } from '@/lib/email/client'
import { dispatchNotification } from '@/lib/notifications/dispatcher'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function checkUptime(url: string): Promise<{ statusCode: number | null; responseTimeMs: number; isUp: boolean; error: string | null }> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    const responseTimeMs = Date.now() - start
    return {
      statusCode: res.status,
      responseTimeMs,
      isUp: res.status >= 200 && res.status < 400,
      error: null,
    }
  } catch (err) {
    const responseTimeMs = Date.now() - start
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      statusCode: null,
      responseTimeMs,
      isUp: false,
      error: message,
    }
  }
}

export const uptimeWorker = new Worker<UptimeCheckJobData>(
  'uptime-check',
  async (job: Job<UptimeCheckJobData>) => {
    const { siteId } = job.data
    const log = jobLogger('uptime-check', job.id)

    const site = await prisma.site.findFirst({
      where: { id: siteId, isActive: true },
      include: { organization: { include: { members: { include: { user: true } } } } },
    })
    if (!site) throw new Error(`Site ${siteId} not found or inactive`)

    await job.updateProgress(10)

    // Use URL from database (not job payload) to prevent SSRF
    const result = await checkUptime(site.url)
    await job.updateProgress(60)

    await prisma.uptimeCheck.create({
      data: {
        siteId,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        isUp: result.isUp,
        error: result.error,
      },
    })
    await job.updateProgress(80)

    // Check for downtime alert: only alert on transition from up to down (dedup)
    if (!result.isUp) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const recentChecks = await prisma.uptimeCheck.findMany({
        where: { siteId, checkedAt: { gte: fiveMinutesAgo } },
        orderBy: { checkedAt: 'desc' },
        take: 3,
      })

      // Need at least 2 consecutive failures and the one before them was UP (transition)
      const allDown = recentChecks.length >= 2 && recentChecks.slice(0, 2).every(c => !c.isUp)
      const isTransition = recentChecks.length === 2 || (recentChecks.length >= 3 && recentChecks[2].isUp)

      if (allDown && isTransition) {
        const recipients = site.organization.members
          .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
          .map(m => m.user.email)
          .filter(Boolean) as string[]

        if (recipients.length > 0) {
          const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/sites/${siteId}/uptime`
          const safeName = escapeHtml(site.name)
          const safeUrl = escapeHtml(site.url)
          const safeError = escapeHtml(result.error || `HTTP ${result.statusCode}`)

          try {
            await sendEmail({
              to: recipients,
              subject: `Glimpse Alert: ${site.name} er nede`,
              html: `
                <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:auto;padding:16px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                    <div style="width:8px;height:8px;border-radius:9999px;background:#ef4444"></div>
                    <strong>Downtime Alert</strong>
                  </div>
                  <h2 style="margin:0 0 12px 0;font-size:18px">${safeName}</h2>
                  <p>${safeUrl} har været nede i over 5 minutter.</p>
                  <p>Seneste fejl: ${safeError}</p>
                  <p><a href="${dashUrl}" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none">Se uptime-status</a></p>
                  <p style="color:#6b7280;font-size:12px;margin-top:16px">Du modtager denne besked fordi du er administrator for denne organisation.</p>
                </div>
              `,
            })
          } catch (emailErr) {
            log.error({ err: emailErr }, 'Failed to send downtime alert email')
          }

          // Dispatch to Slack/webhook channels
          try {
            await dispatchNotification(site.organizationId, {
              event: 'uptime',
              title: `Downtime: ${site.name} er nede`,
              message: `${site.url} har været nede i over 5 minutter. Fejl: ${result.error || `HTTP ${result.statusCode}`}`,
              severity: 'critical',
              url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/sites/${siteId}/uptime`,
              fields: [
                { label: 'Site', value: site.name },
                { label: 'URL', value: site.url },
                { label: 'Fejl', value: result.error || `HTTP ${result.statusCode}` },
              ],
            })
          } catch { /* notification dispatch failure should not block uptime checks */ }
        }
      }
    }

    await job.updateProgress(100)

    return {
      siteId,
      url: site.url,
      isUp: result.isUp,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: { max: 20, duration: 60000 },
  }
)

uptimeWorker.on('failed', async (job, err) => {
  const log = jobLogger('uptime-check', job?.id)
  log.error({ err }, 'Uptime check job failed')
  await moveToDeadLetter(job, err)
})

uptimeWorker.on('completed', (job, result) => {
  const log = jobLogger('uptime-check', job.id)
  log.info({ result }, 'Uptime check job completed')
})
