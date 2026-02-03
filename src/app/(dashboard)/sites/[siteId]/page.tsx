import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'

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

  // Verify site exists and is accessible, then redirect to Overview as default landing
  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId: organizationId, isActive: true },
    select: { id: true }
  })

  if (!site) {
    notFound()
  }

  // Default landing → Overview
  return redirect(`/sites/${site.id}/overview`)
}
