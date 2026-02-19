import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { OnboardingWizard } from './onboarding-wizard'

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  // If user not found in DB or already completed onboarding, redirect
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboardingCompletedAt: true } })
  if (!user) redirect('/auth/sign-in')
  if (user.onboardingCompletedAt) redirect('/sites')

  const organizationId = session.session.activeOrganizationId

  // Fetch existing sites for the org (if any)
  const sites = organizationId
    ? await prisma.site.findMany({
        where: { organizationId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  return (
    <OnboardingWizard
      sites={sites.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        url: s.url,
        gscPropertyUrl: s.gscPropertyUrl,
        gscConnectedAt: s.gscConnectedAt?.toISOString() ?? null,
      }))}
    />
  )
}
