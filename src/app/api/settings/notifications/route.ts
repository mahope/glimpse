import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const PrefsSchema = z.object({
  dailyReport: z.boolean(),
  weeklyAlerts: z.boolean(),
  crawlSummary: z.boolean(),
})

export type NotificationPrefs = z.infer<typeof PrefsSchema>

export const DEFAULT_PREFS: NotificationPrefs = {
  dailyReport: true,
  weeklyAlerts: true,
  crawlSummary: false,
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  })

  const prefs = user?.notificationPrefs as NotificationPrefs | null
  return NextResponse.json(prefs ?? DEFAULT_PREFS)
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = PrefsSchema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Invalid data', details: body.error.errors }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: body.data },
  })

  return NextResponse.json(body.data)
}
