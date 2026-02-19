import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { TeamClient } from './team-client'

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect('/dashboard')

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
  })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })

  if (!org) redirect('/dashboard')

  return <TeamClient organizationId={org.id} orgName={org.name} currentUserRole={membership?.role || 'MEMBER'} currentUserId={session.user.id} />
}
