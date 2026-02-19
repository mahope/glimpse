import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { NotificationChannelType } from '@prisma/client'
import { validateConfig } from '@/lib/notifications/validation'

const VALID_EVENTS = ['alert', 'report', 'uptime'] as const

const CreateChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(NotificationChannelType),
  config: z.record(z.unknown()),
  events: z.array(z.enum(VALID_EVENTS)).min(1),
  enabled: z.boolean().optional().default(true),
})

const UpdateChannelSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  enabled: z.boolean().optional(),
})

async function getCallerMembership(organizationId: string, userId: string) {
  return prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })
}

// GET: List notification channels (OWNER/ADMIN only)
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const membership = await getCallerMembership(organizationId, session.user.id)
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const channels = await prisma.notificationChannel.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  })

  // Redact secrets in config before sending to client
  const safeChannels = channels.map(ch => ({
    ...ch,
    config: redactConfig(ch.type, ch.config as Record<string, unknown>),
  }))

  return NextResponse.json({ channels: safeChannels })
}

// POST: Create a new notification channel
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const membership = await getCallerMembership(organizationId, session.user.id)
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateChannelSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })

  // Validate config shape based on type
  const configResult = validateConfig(parsed.data.type, parsed.data.config)
  if (!configResult.ok) return NextResponse.json({ error: configResult.error }, { status: 400 })

  const channel = await prisma.notificationChannel.create({
    data: {
      organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      config: parsed.data.config,
      events: parsed.data.events,
      enabled: parsed.data.enabled,
    },
  })

  return NextResponse.json(channel, { status: 201 })
}

// PATCH: Update a notification channel
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const membership = await getCallerMembership(organizationId, session.user.id)
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateChannelSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const existing = await prisma.notificationChannel.findFirst({
    where: { id: parsed.data.channelId, organizationId },
  })
  if (!existing) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // If config is being updated, validate its shape
  if (parsed.data.config) {
    const configResult = validateConfig(existing.type, parsed.data.config)
    if (!configResult.ok) return NextResponse.json({ error: configResult.error }, { status: 400 })
  }

  const updated = await prisma.notificationChannel.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.config !== undefined && { config: parsed.data.config }),
      ...(parsed.data.events !== undefined && { events: parsed.data.events }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE: Remove a notification channel
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const membership = await getCallerMembership(organizationId, session.user.id)
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const channelId = req.nextUrl.searchParams.get('channelId')
  if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

  const existing = await prisma.notificationChannel.findFirst({
    where: { id: channelId, organizationId },
  })
  if (!existing) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  await prisma.notificationChannel.delete({ where: { id: existing.id } })

  return NextResponse.json({ ok: true })
}

function redactConfig(type: NotificationChannelType, config: Record<string, unknown>): Record<string, unknown> {
  if (type === 'SLACK') {
    return {
      ...config,
      webhookUrl: 'https://hooks.slack.com/services/•••',
    }
  }
  if (type === 'WEBHOOK') {
    return {
      ...config,
      secret: config.secret ? '••••••••' : undefined,
    }
  }
  return config
}
