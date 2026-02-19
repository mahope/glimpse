import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { SiteNav } from '@/components/site/site-nav'
import { RecommendationsClient } from './recommendations-client'

export default async function RecommendationsPage({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect('/dashboard')

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId, isActive: true },
    select: { id: true, name: true },
  })
  if (!site) notFound()

  return (
    <div className="space-y-6">
      <SiteNav siteId={site.id} active="recommendations" />
      <RecommendationsClient siteId={site.id} siteName={site.name} />
    </div>
  )
}
