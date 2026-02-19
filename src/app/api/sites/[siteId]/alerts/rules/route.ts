import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const RuleSchema = z.object({
  metric: z.enum(['LCP','INP','CLS','SCORE_DROP']),
  device: z.enum(['ALL','MOBILE','DESKTOP']).default('ALL'),
  threshold: z.number().finite(),
  windowDays: z.number().int().min(1).max(30).default(1),
  enabled: z.boolean().default(true),
  recipients: z.array(z.string().email()).default([]),
})

async function verifySiteAccess(request: NextRequest, siteId: string) {
  const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return { error: NextResponse.json({ error: 'No active organization' }, { status: 403 }) }

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId, isActive: true },
    select: { id: true },
  })
  if (!site) return { error: NextResponse.json({ error: 'Site not found' }, { status: 404 }) }

  return { site, session }
}

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  const access = await verifySiteAccess(request, params.siteId)
  if ('error' in access) return access.error

  const rules = await prisma.alertRule.findMany({ where: { siteId: access.site.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ items: rules })
}

export async function POST(request: NextRequest, { params }: { params: { siteId: string } }) {
  const access = await verifySiteAccess(request, params.siteId)
  if ('error' in access) return access.error

  const raw = await request.json().catch(() => ({}))
  const data = RuleSchema.parse(raw)

  const created = await prisma.alertRule.create({ data: { ...data, siteId: access.site.id } })
  return NextResponse.json({ item: created }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: { siteId: string } }) {
  const access = await verifySiteAccess(request, params.siteId)
  if ('error' in access) return access.error

  const raw = await request.json().catch(() => ({}))
  const updateSchema = RuleSchema.partial().extend({ id: z.string().min(1) })
  const data = updateSchema.parse(raw)

  const existing = await prisma.alertRule.findFirst({ where: { id: data.id, siteId: access.site.id } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  const { id, ...patch } = data as any
  const updated = await prisma.alertRule.update({ where: { id }, data: patch })
  return NextResponse.json({ item: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: { siteId: string } }) {
  const access = await verifySiteAccess(request, params.siteId)
  if ('error' in access) return access.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const existing = await prisma.alertRule.findFirst({ where: { id, siteId: access.site.id } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  await prisma.alertRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
