import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { BrandingForm } from './branding-form'

export default async function BrandingPage() {
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

  const canEdit = membership?.role === 'OWNER' || membership?.role === 'ADMIN'

  return <BrandingForm canEdit={canEdit} />
}
