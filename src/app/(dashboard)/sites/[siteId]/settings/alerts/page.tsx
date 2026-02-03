import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { RulesClient } from './RulesClient'

export default async function SiteAlertSettings({ params }: { params: { siteId: string } }) {
  const site = await prisma.site.findUnique({ where: { id: params.siteId } })
  if (!site) return notFound()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Alert Rules</h1>
      <RulesClient siteId={site.id} />
    </div>
  )
}
