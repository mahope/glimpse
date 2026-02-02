import { NextRequest, NextResponse } from 'next/server'
import { registerRepeatableJobsForAllSites } from '@/lib/jobs/register'
import { verifyCronSecret } from '@/lib/cron/auth'

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized
  const count = await registerRepeatableJobsForAllSites()
  return NextResponse.json({ ok: true, sites: count })
}
