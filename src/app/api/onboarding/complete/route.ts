import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompletedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
