import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

async function verifySiteAccess(siteId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return { error: NextResponse.json({ error: 'No active organization' }, { status: 403 }) }
  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId, isActive: true }, select: { id: true } })
  if (!site) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { site }
}

// Assign tag to keywords (bulk)
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const body = await req.json()
  const tagId = String(body.tagId ?? '')
  const queries: string[] = Array.isArray(body.queries) ? body.queries.map(String) : []

  if (!tagId || queries.length === 0) {
    return NextResponse.json({ error: 'tagId og queries påkrævet' }, { status: 400 })
  }

  // Verify tag belongs to this site
  const tag = await prisma.keywordTag.findFirst({ where: { id: tagId, siteId: params.siteId } })
  if (!tag) return NextResponse.json({ error: 'Tag ikke fundet' }, { status: 404 })

  // Bulk upsert assignments (skipDuplicates)
  await prisma.keywordTagAssignment.createMany({
    data: queries.map(query => ({ tagId, siteId: params.siteId, query })),
    skipDuplicates: true,
  })

  return NextResponse.json({ ok: true, assigned: queries.length })
}

// Unassign tag from keywords
export async function DELETE(req: NextRequest, { params }: { params: { siteId: string } }) {
  const result = await verifySiteAccess(params.siteId)
  if ('error' in result) return result.error

  const { searchParams } = new URL(req.url)
  const tagId = searchParams.get('tagId')
  const query = searchParams.get('query')

  if (!tagId) return NextResponse.json({ error: 'tagId påkrævet' }, { status: 400 })

  const where: { tagId: string; siteId: string; query?: string } = { tagId, siteId: params.siteId }
  if (query) where.query = query

  await prisma.keywordTagAssignment.deleteMany({ where })
  return NextResponse.json({ ok: true })
}
