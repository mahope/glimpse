import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SiteNav } from '@/components/site/site-nav'
import { ReportsClient } from './reports-client'

export default async function ReportsPage({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect('/dashboard')

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId },
    select: { id: true, name: true, domain: true, reportSchedule: true }
  })
  if (!site) redirect('/sites')

  return (
    <div className="space-y-6">
      <SiteNav siteId={site.id} active="reports" />
      <ReportsClient siteId={site.id} siteName={site.name} domain={site.domain} initialSchedule={site.reportSchedule} />
    </div>
  )
}
