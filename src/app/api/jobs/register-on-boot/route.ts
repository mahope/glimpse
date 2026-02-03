import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron/auth'
import { enqueueDailyForActiveSites } from '@/lib/jobs/gscQueue'

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized
  try {
    const result = await enqueueDailyForActiveSites(30)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
