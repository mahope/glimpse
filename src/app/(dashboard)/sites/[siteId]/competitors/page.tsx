import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CompetitorsClient } from './competitors-client'

export default async function CompetitorsPage({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect('/dashboard')

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId },
    select: { id: true },
  })
  if (!site) notFound()

  return <CompetitorsClient siteId={params.siteId} />
}
