import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron/auth'
import { fetchAndStoreGSCDaily } from '@/lib/gsc/fetch-daily'
import { decrypt } from '@/lib/crypto'
import { invalidateCache } from '@/lib/cache'

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('siteId')
  const days = Number(searchParams.get('days') || '30')

  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 })

  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  if (!site.gscPropertyUrl) return NextResponse.json({ error: 'GSC not connected' }, { status: 400 })

  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days)

  const result = await fetchAndStoreGSCDaily({
    siteId,
    propertyUrl: site.gscPropertyUrl,
    refreshToken: site.gscRefreshToken ? decrypt(site.gscRefreshToken) : undefined,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    mock: process.env.MOCK_GSC === 'true'
  })

  // Invalidate overview cache so fresh data is served
  await invalidateCache(`overview:${siteId}:*`)

  return NextResponse.json({ ok: true, result })
}
