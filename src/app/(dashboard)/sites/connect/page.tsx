import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { GSCConnectClient } from './connect-client'

export default async function ConnectSitePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) {
    redirect('/dashboard')
  }

  const sites = await prisma.site.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Connect Google Search Console</h1>
      <p className="text-gray-600">Authorize access and select the property that matches each site.</p>
      <GSCConnectClient sites={sites.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        url: s.url,
        gscPropertyUrl: s.gscPropertyUrl,
        gscConnectedAt: s.gscConnectedAt?.toISOString() ?? null,
      }))} />
    </div>
  )
}
