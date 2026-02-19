import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email/client'
import { z } from 'zod'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// GET: List pending invitations for the active organization
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

  const invitations = await prisma.invitation.findMany({
    where: { organizationId, status: 'pending' },
    include: { inviter: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    invitations: invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.inviter.name || inv.inviter.email,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  })
}

// POST: Create a new invitation
const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
})

export async function POST(req: NextRequest) {
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

  const parsed = InviteSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  // Only OWNER can invite as ADMIN
  if (parsed.data.role === 'ADMIN' && callerMembership.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the owner can invite admins' }, { status: 403 })
  }

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existingUser) {
    const existingMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: existingUser.id } },
    })
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }
  }

  // Check for pending invitation
  const existingInvite = await prisma.invitation.findFirst({
    where: { organizationId, email: parsed.data.email, status: 'pending' },
  })
  if (existingInvite) {
    return NextResponse.json({ error: 'Invitation already pending' }, { status: 409 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })

  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  })

  // Send invitation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const acceptUrl = `${appUrl}/invite/${invitation.id}`
  const safeOrgName = escapeHtml(org?.name || 'en organisation')
  const safeInviterName = escapeHtml(session.user.name || session.user.email || '')
  try {
    await sendEmail({
      to: parsed.data.email,
      subject: `Du er inviteret til ${org?.name || 'en organisation'} på Glimpse`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:auto;padding:16px">
          <h2 style="margin:0 0 12px 0;font-size:18px">Du er inviteret!</h2>
          <p>${safeInviterName} har inviteret dig til <b>${safeOrgName}</b> på Glimpse.</p>
          <p>Din rolle: <b>${parsed.data.role === 'ADMIN' ? 'Administrator' : 'Medlem'}</b></p>
          <p><a href="${acceptUrl}" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Accepter invitation</a></p>
          <p style="color:#6b7280;font-size:12px;margin-top:16px">Denne invitation udløber om 7 dage.</p>
        </div>
      `,
    })
  } catch {
    // Email failure shouldn't prevent invitation creation
  }

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  })
}

// DELETE: Cancel a pending invitation
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

  const invitationId = req.nextUrl.searchParams.get('invitationId')
  if (!invitationId) return NextResponse.json({ error: 'Missing invitationId' }, { status: 400 })

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId, status: 'pending' },
  })
  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'cancelled' },
  })

  return NextResponse.json({ ok: true })
}
