import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const SetActiveOrgSchema = z.object({
  organizationId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId } = SetActiveOrgSchema.parse(body)

    // Verify user is a member of this organization
    const membership = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organizationId,
          userId: session.user.id,
        },
      },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 404 }
      )
    }

    // Update the session's active organization
    // Note: This implementation depends on Better Auth's session structure
    // You might need to adjust this based on how Better Auth handles custom session data
    await prisma.session.updateMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() }, // Only active sessions
      },
      data: {
        activeOrganizationId: organizationId,
      },
    })

    return NextResponse.json({
      success: true,
      activeOrganizationId: organizationId,
      organizationName: membership.organization.name,
    })
  } catch (error) {
    console.error('Failed to set active organization:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to set active organization' },
      { status: 500 }
    )
  }
}