import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { SiteDetails } from '@/components/dashboard/site-details'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface SitePageProps {
  params: {
    siteId: string
  }
}

export default async function SitePage({ params }: SitePageProps) {
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

  // Fetch site with all related data
  const site = await prisma.site.findFirst({
    where: {
      id: params.siteId,
      organizationId: organizationId,
      isActive: true,
    },
    include: {
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
      searchConsoleData: {
        orderBy: { date: 'desc' },
        take: 30, // Last 30 days
      },
      performanceTests: {
        orderBy: { createdAt: 'desc' },
        take: 10, // Last 10 tests
      },
      seoScores: {
        orderBy: { date: 'desc' },
        take: 30, // Last 30 days
      },
    },
  })

  if (!site) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{site.name}</h1>
          <p className="text-gray-600 mt-2">{site.domain}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/sites">← Back to Sites</Link>
          </Button>
          <Button asChild>
            <Link href={`/sites/${site.id}/performance`}>View Performance</Link>
          </Button>
        </div>
      </div>

      <SiteDetails site={site} />
    </div>
  )
}