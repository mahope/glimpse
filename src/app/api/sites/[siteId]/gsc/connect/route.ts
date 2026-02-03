import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { registerRepeatableJobsForSite } from '@/lib/jobs/register'
import { createDefaultGSCDataSyncService } from '@/lib/gsc/sync'

const Body = z.object({ propertyUrl: z.string().min(1) })

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const body = Body.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get tokens from cookie
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/gsc_tokens=([^;]+)/)
  if (!match) return NextResponse.json({ error: 'Missing OAuth tokens' }, { status: 400 })
  const raw = decodeURIComponent(match[1])
  const parsed = JSON.parse(raw)
  const encrypted = await (await import('@/lib/gsc/gsc-service')).GSCService.encryptToken(parsed.refresh_token)

  // Persist selection
  await prisma.site.update({ where: { id: site.id }, data: { gscPropertyUrl: body.data.propertyUrl, gscRefreshToken: encrypted, gscConnectedAt: new Date() } })

  // Backfill last 90 days
  try {
    const sync = createDefaultGSCDataSyncService(prisma as any)
    await sync.syncSiteData(site.id, { startDate: getNDaysAgo(90), endDate: getNDaysAgo(1) })
  } catch (e) {
    console.warn('Backfill failed', e)
  }

  // Register repeatable jobs for this site
  await registerRepeatableJobsForSite({ id: site.id, organizationId, url: site.url })

  return NextResponse.json({ ok: true })
}

function getNDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}
