import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron/auth'
import { prisma } from '@/lib/db'
import { triggerJob } from '@/lib/jobs/queue'

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized
  try {
    const sites = await prisma.site.findMany({
      where: { isActive: true, gscRefreshToken: { not: null } },
      select: { id: true, organizationId: true },
    })
    let enqueued = 0
    for (const s of sites) {
      await triggerJob.gscSync(s.id, s.organizationId)
      enqueued++
    }
    return NextResponse.json({ ok: true, enqueued })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
