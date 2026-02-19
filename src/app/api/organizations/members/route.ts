import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// GET: List members of the active organization
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  // Verify caller is a member of this organization
  const callerMembership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  })
  if (!callerMembership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      joinedAt: m.createdAt,
    })),
  })
}

// PATCH: Update a member's role
const UpdateRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER']),
})

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  // Check caller is OWNER or ADMIN
  const callerMembership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  })
  if (!callerMembership || (callerMembership.role !== 'OWNER' && callerMembership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateRoleSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const target = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, organizationId },
  })
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Cannot change OWNER role
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 })
  }

  // Only OWNER can grant ADMIN role
  if (parsed.data.role === 'ADMIN' && callerMembership.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the owner can promote to admin' }, { status: 403 })
  }

  await prisma.member.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  })

  return NextResponse.json({ ok: true })
}

// DELETE: Remove a member
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const callerMembership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  })
  if (!callerMembership || (callerMembership.role !== 'OWNER' && callerMembership.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const memberId = req.nextUrl.searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
  })
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Cannot remove OWNER
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 })
  }

  // Only OWNER can remove ADMINs
  if (target.role === 'ADMIN' && callerMembership.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the owner can remove admins' }, { status: 403 })
  }

  // Cannot remove yourself
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  await prisma.member.delete({ where: { id: target.id } })

  return NextResponse.json({ ok: true })
}
