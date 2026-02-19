import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rawDays = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  const days = Number.isNaN(rawDays) ? 30 : Math.min(90, Math.max(1, rawDays))
  const since = new Date()
  since.setDate(since.getDate() - days)

  const checks = await prisma.uptimeCheck.findMany({
    where: { siteId: site.id, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'desc' },
    take: 30000,
    select: {
      id: true,
      checkedAt: true,
      statusCode: true,
      responseTimeMs: true,
      isUp: true,
      error: true,
    },
  })

  const totalChecks = checks.length
  const successfulChecks = checks.filter(c => c.isUp)
  const uptimePct = totalChecks > 0 ? (successfulChecks.length / totalChecks) * 100 : null
  const avgResponseTime = successfulChecks.length > 0
    ? Math.round(successfulChecks.reduce((sum, c) => sum + (c.responseTimeMs ?? 0), 0) / successfulChecks.length)
    : null

  // Find incidents (consecutive downtime periods)
  const incidents: Array<{ start: string; end: string; durationMinutes: number; error: string | null }> = []
  let incidentStart: Date | null = null
  let lastError: string | null = null

  // Checks are desc order, reverse for chronological processing
  const chronological = [...checks].reverse()
  for (const check of chronological) {
    if (!check.isUp) {
      if (!incidentStart) {
        incidentStart = new Date(check.checkedAt)
        lastError = check.error
      }
    } else if (incidentStart) {
      incidents.push({
        start: incidentStart.toISOString(),
        end: new Date(check.checkedAt).toISOString(),
        durationMinutes: Math.round((new Date(check.checkedAt).getTime() - incidentStart.getTime()) / 60000),
        error: lastError,
      })
      incidentStart = null
      lastError = null
    }
  }
  // If still in an incident at the end
  if (incidentStart) {
    incidents.push({
      start: incidentStart.toISOString(),
      end: new Date().toISOString(),
      durationMinutes: Math.round((Date.now() - incidentStart.getTime()) / 60000),
      error: lastError,
    })
  }

  // Aggregate response times into hourly buckets for chart
  const hourlyMap = new Map<string, { sum: number; count: number; downCount: number }>()
  for (const check of checks) {
    const hour = new Date(check.checkedAt).toISOString().slice(0, 13) + ':00:00.000Z'
    const bucket = hourlyMap.get(hour) || { sum: 0, count: 0, downCount: 0 }
    bucket.sum += check.responseTimeMs ?? 0
    bucket.count += 1
    if (!check.isUp) bucket.downCount += 1
    hourlyMap.set(hour, bucket)
  }

  const timeline = Array.from(hourlyMap.entries())
    .map(([hour, bucket]) => ({
      time: hour,
      avgResponseMs: Math.round(bucket.sum / bucket.count),
      checks: bucket.count,
      downCount: bucket.downCount,
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  return NextResponse.json({
    uptimePct: uptimePct !== null ? Math.round(uptimePct * 100) / 100 : null,
    avgResponseTime,
    totalChecks,
    currentStatus: checks[0]?.isUp ?? null,
    lastChecked: checks[0]?.checkedAt ?? null,
    timeline,
    incidents: incidents.reverse(), // Most recent first
  })
}
