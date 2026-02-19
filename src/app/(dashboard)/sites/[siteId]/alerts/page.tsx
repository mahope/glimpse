import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { AlertStatus } from '@prisma/client'
import { SiteNav } from '@/components/site/site-nav'

function statusBadge(s: AlertStatus) {
  const base = 'px-2 py-1 rounded text-xs'
  if (s === 'OPEN') return base + ' bg-red-100 text-red-700'
  return base + ' bg-green-100 text-green-700'
}

export default async function AlertsPage({ params }: { params: { siteId: string } }) {
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

  const events = await prisma.alertEvent.findMany({ where: { siteId: site.id }, orderBy: { date: 'desc' } })

  return (
    <div className="space-y-6">
      <SiteNav siteId={params.siteId} active="alerts" />
      <h1 className="text-2xl font-semibold">Alerts</h1>
      {events.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Metric</th>
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-b">
                  <td className="py-2 pr-4">{new Date(ev.date).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{ev.metric}</td>
                  <td className="py-2 pr-4">{ev.device}</td>
                  <td className="py-2 pr-4">{ev.value}</td>
                  <td className="py-2 pr-4"><span className={statusBadge(ev.status)}>{ev.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">No alert events yet.</p>
      )}
    </div>
  )
}
