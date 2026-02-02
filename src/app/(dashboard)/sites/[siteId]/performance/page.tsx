import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { SitePerformance } from '@/components/dashboard/site-performance'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface PerformancePageProps {
  params: {
    siteId: string
  }
}

export default async function PerformancePage({ params }: PerformancePageProps) {
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

  // Fetch site with performance data
  const site = await prisma.site.findFirst({
    where: {
      id: params.siteId,
      organizationId: organizationId,
      isActive: true,
    },
    include: {
      performanceTests: {
        orderBy: { createdAt: 'desc' },
        take: 50, // Last 50 tests
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
          <h1 className="text-3xl font-bold text-gray-900">Performance - {site.name}</h1>
          <p className="text-gray-600 mt-2">Core Web Vitals and PageSpeed insights</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/sites/${site.id}`}>← Back to Site</Link>
          </Button>
          <Button asChild>
            <Link href="/sites">All Sites</Link>
          </Button>
        </div>
      </div>

      <SitePerformance site={site} />
    </div>
  )
}