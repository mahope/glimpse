import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AlertMetric, PerfDevice } from '@prisma/client'

const RuleSchema = z.object({
  metric: z.nativeEnum(AlertMetric),
  device: z.nativeEnum(PerfDevice).default('ALL'),
  threshold: z.number().finite(),
  windowDays: z.number().int().min(1).max(30).default(1),
  enabled: z.boolean().default(true),
  recipients: z.array(z.string().email()).default([]),
})

export async function GET(request: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const site = await prisma.site.findUnique({
    where: { id: params.siteId },
    include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
  })
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  const isAdmin = (session.user as any).role === 'ADMIN'
  const hasOrgAccess = site.organization.members.length > 0
  if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const rules = await prisma.alertRule.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ items: rules })
}

export async function POST(request: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const site = await prisma.site.findUnique({
    where: { id: params.siteId },
    include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
  })
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  const isAdmin = (session.user as any).role === 'ADMIN'
  const hasOrgAccess = site.organization.members.length > 0
  if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const raw = await request.json().catch(() => ({}))
  const data = RuleSchema.parse(raw)

  const created = await prisma.alertRule.create({ data: { ...data, siteId: site.id } })
  return NextResponse.json({ item: created }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const site = await prisma.site.findUnique({
    where: { id: params.siteId },
    include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
  })
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  const isAdmin = (session.user as any).role === 'ADMIN'
  const hasOrgAccess = site.organization.members.length > 0
  if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const raw = await request.json().catch(() => ({}))
  const updateSchema = RuleSchema.partial().extend({ id: z.string().cuid() })
  const data = updateSchema.parse(raw)

  const existing = await prisma.alertRule.findFirst({ where: { id: data.id, siteId: site.id } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  const updated = await prisma.alertRule.update({ where: { id: data.id }, data: { ...data, id: undefined as any } })
  return NextResponse.json({ item: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: Object.fromEntries(request.headers.entries()) })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const site = await prisma.site.findUnique({
    where: { id: params.siteId },
    include: { organization: { include: { members: { where: { userId: session.user.id } } } } },
  })
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  const isAdmin = (session.user as any).role === 'ADMIN'
  const hasOrgAccess = site.organization.members.length > 0
  if (!isAdmin && !hasOrgAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const existing = await prisma.alertRule.findFirst({ where: { id, siteId: site.id } })
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  await prisma.alertRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
