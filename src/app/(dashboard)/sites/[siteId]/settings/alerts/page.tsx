import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { RulesClient } from './RulesClient'
import { SiteNav } from '@/components/site/site-nav'

export default async function SiteAlertSettings({ params }: { params: { siteId: string } }) {
  const site = await prisma.site.findUnique({ where: { id: params.siteId } })
  if (!site) return notFound()

  return (
    <div className="space-y-6">
      <SiteNav siteId={site.id} active="settings" />
      <h1 className="text-2xl font-semibold">Alert Rules</h1>
      <RulesClient siteId={site.id} />
    </div>
  )
}
