import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const BrandingSchema = z.object({
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  reportHeaderText: z.string().trim().max(200).nullable().optional(),
  reportFooterText: z.string().trim().max(200).nullable().optional(),
  hideGlimpseBrand: z.boolean().optional(),
})

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { brandColor: true, reportHeaderText: true, reportFooterText: true, hideGlimpseBrand: true, logo: true },
  })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(org)
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  // Check user is OWNER or ADMIN
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  })
  if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BrandingSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: parsed.data,
    select: { brandColor: true, reportHeaderText: true, reportFooterText: true, hideGlimpseBrand: true, logo: true },
  })

  return NextResponse.json(updated)
}
