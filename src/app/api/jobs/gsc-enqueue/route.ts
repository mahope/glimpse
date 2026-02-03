import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron/auth'
import { enqueueDailyForActiveSites } from '@/lib/jobs/gscQueue'

export async function POST(req: NextRequest) {
  const unauthorized = verifyCronSecret(req)
  if (unauthorized) return unauthorized
  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') || '30')
  const result = await enqueueDailyForActiveSites(days)
  return NextResponse.json(result)
}
