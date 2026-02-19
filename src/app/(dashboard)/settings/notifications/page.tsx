import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { NotificationsForm } from './notifications-form'
import { ChannelsClient } from './channels-client'

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')
  const organizationId = session.session.activeOrganizationId

  const membership = organizationId
    ? await prisma.member.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
      })
    : null

  const canManage = membership?.role === 'OWNER' || membership?.role === 'ADMIN'

  return (
    <div className="space-y-8">
      <NotificationsForm />
      {organizationId && <ChannelsClient canManage={canManage} />}
    </div>
  )
}
