import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SitesList } from '@/components/dashboard/sites-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function SitesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  // Redirect to onboarding if not completed
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboardingCompletedAt: true } })
  if (!user?.onboardingCompletedAt) {
    redirect('/onboarding')
  }

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">No Organization Selected</h2>
          <p className="text-muted-foreground mb-6">
            You need to be a member of an organization to manage sites.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Fetch sites for the active organization
  const sites = await prisma.site.findMany({
    where: {
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
      _count: {
        select: {
          searchConsoleData: true,
          performanceTests: true,
          seoScores: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sites</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected websites and their SEO performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/sites/connect">Connect New Site</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/jobs">Job Monitor</Link>
          </Button>
        </div>
      </div>

      <SitesList sites={sites} />
    </div>
  )
}