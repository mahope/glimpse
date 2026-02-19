import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { NotificationChannelType } from '@prisma/client'
import { sendTestNotification } from '@/lib/notifications/dispatcher'
import { validateConfig } from '@/lib/notifications/validation'

const TestSchema = z.object({
  channelId: z.string().min(1).optional(),
  type: z.nativeEnum(NotificationChannelType).optional(),
  config: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const membership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  })
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = TestSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  let type: NotificationChannelType
  let config: Record<string, unknown>

  if (parsed.data.channelId) {
    // Test an existing saved channel
    const channel = await prisma.notificationChannel.findFirst({
      where: { id: parsed.data.channelId, organizationId },
    })
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    type = channel.type
    config = channel.config as Record<string, unknown>
  } else if (parsed.data.type && parsed.data.config) {
    // Validate config before testing unsaved config
    const configResult = validateConfig(parsed.data.type, parsed.data.config)
    if (!configResult.ok) return NextResponse.json({ error: configResult.error }, { status: 400 })
    type = parsed.data.type
    config = parsed.data.config
  } else {
    return NextResponse.json({ error: 'Provide channelId or type+config' }, { status: 400 })
  }

  try {
    await sendTestNotification(type, config)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Test failed: ${message}` }, { status: 502 })
  }
}
