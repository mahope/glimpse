import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PerfTable } from '@/components/perf/PerfTable'
import { PerfTrends } from '@/components/perf/PerfTrends'

interface PerformancePageProps {
  params: {
    siteId: string
  }
}

export default async function PerformancePage({ params }: PerformancePageProps) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  // Verify site access
  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organization: { members: { some: { userId: session.user.id } } }, isActive: true },
    select: { id: true, name: true },
  })
  if (!site) notFound()

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

      <div className="grid gap-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Latest</h2>
          <PerfTable siteId={site.id} />
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Trends (30 days)</h2>
          <PerfTrends siteId={site.id} days={30} />
        </section>
      </div>
    </div>
  )
}
