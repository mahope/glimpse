import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { RulesClient } from './RulesClient'
import { SiteNav } from '@/components/site/site-nav'

export default async function SiteAlertSettings({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) {
    redirect('/dashboard')
  }

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId, isActive: true },
    select: { id: true },
  })
  if (!site) return notFound()

  return (
    <div className="space-y-6">
      <SiteNav siteId={site.id} active="settings" />
      <h1 className="text-2xl font-semibold">Alert Rules</h1>
      <RulesClient siteId={site.id} />
    </div>
  )
}
