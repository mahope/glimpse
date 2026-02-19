import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(HEX_COLOR).default('#6b7280'),
})

const UpdateTagSchema = z.object({
  tagId: z.string().min(1),
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().regex(HEX_COLOR).optional(),
})

async function verifySiteAccess(siteId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return { error: NextResponse.json({ error: 'No active organization' }, { status: 403 }) }
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true }, select: { id: true } })
  if (!site) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { site }
}

// List tags for a site (with assignment counts)
export async function GET(_req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const tags = await prisma.keywordTag.findMany({
    where: { siteId: params.siteId },
    include: { _count: { select: { assignments: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ tags })
}

// Create a new tag
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const parsed = CreateTagSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldigt input' }, { status: 400 })
  const { name, color } = parsed.data

  const existing = await prisma.keywordTag.findUnique({ where: { siteId_name: { siteId: params.siteId, name } } })
  if (existing) return NextResponse.json({ error: 'Tag eksisterer allerede' }, { status: 409 })

  const tag = await prisma.keywordTag.create({ data: { siteId: params.siteId, name, color } })
  return NextResponse.json({ tag }, { status: 201 })
}

// Update a tag (name/color)
export async function PATCH(req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const parsed = UpdateTagSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldigt input' }, { status: 400 })
  const { tagId, name, color } = parsed.data

  const tag = await prisma.keywordTag.findFirst({ where: { id: tagId, siteId: params.siteId } })
  if (!tag) return NextResponse.json({ error: 'Tag ikke fundet' }, { status: 404 })

  const updates: { name?: string; color?: string } = {}
  if (name !== undefined) updates.name = name
  if (color !== undefined) updates.color = color

  const updated = await prisma.keywordTag.update({ where: { id: tagId }, data: updates })
  return NextResponse.json({ tag: updated })
}

// Delete a tag
export async function DELETE(req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const { searchParams } = new URL(req.url)
  const tagId = searchParams.get('tagId')
  if (!tagId) return NextResponse.json({ error: 'tagId påkrævet' }, { status: 400 })

  const tag = await prisma.keywordTag.findFirst({ where: { id: tagId, siteId: params.siteId } })
  if (!tag) return NextResponse.json({ error: 'Tag ikke fundet' }, { status: 404 })

  await prisma.keywordTag.delete({ where: { id: tagId } })
  return NextResponse.json({ ok: true })
}
