import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  const orgId = session.session.activeOrganizationId
  let orgInfo: { name: string; role: string } | null = null
  if (orgId) {
    const member = await prisma.member.findFirst({
      where: { userId: session.user.id, organizationId: orgId },
      include: { organization: { select: { name: true } } },
    })
    if (member) {
      orgInfo = { name: member.organization.name, role: member.role }
    }
  }

  return (
    <ProfileForm
      user={{ name: session.user.name || '', email: session.user.email }}
      organization={orgInfo}
    />
  )
}
