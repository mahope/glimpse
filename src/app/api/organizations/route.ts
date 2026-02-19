import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/organizations')

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's organizations with role
    const memberships = await prisma.member.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    const organizations = memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logo: membership.organization.logo,
      role: membership.role,
    }))

    return NextResponse.json({
      organizations,
      activeOrganizationId: session.session.activeOrganizationId,
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch organizations')
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}