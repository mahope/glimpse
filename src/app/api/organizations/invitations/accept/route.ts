import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const AcceptSchema = z.object({
  invitationId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AcceptSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const invitation = await prisma.invitation.findUnique({
    where: { id: parsed.data.invitationId },
  })

  if (!invitation || invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 })
  }

  if (new Date() > invitation.expiresAt) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } })
    return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
  }

  if (session.user.email !== invitation.email) {
    return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
  }

  // Check not already a member
  const existingMember = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: invitation.organizationId,
        userId: session.user.id,
      },
    },
  })
  if (existingMember) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } })
    return NextResponse.json({ ok: true, alreadyMember: true })
  }

  // Create membership and mark invitation as accepted atomically
  try {
    await prisma.$transaction([
      prisma.member.create({
        data: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      }),
    ])
  } catch (err: unknown) {
    // P2002 = unique constraint violation (race condition: already a member)
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } })
      return NextResponse.json({ ok: true, alreadyMember: true })
    }
    throw err
  }

  // Set as active organization
  await prisma.session.updateMany({
    where: { userId: session.user.id },
    data: { activeOrganizationId: invitation.organizationId },
  })

  return NextResponse.json({ ok: true })
}
