import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const status: { status: string; db: boolean; timestamp: string } = {
    status: 'ok',
    db: false,
    timestamp: new Date().toISOString(),
  }

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    status.db = true
  } catch {
    status.status = 'degraded'
  }

  const httpStatus = status.db ? 200 : 503
  return NextResponse.json(status, { status: httpStatus })
}
