import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ReportPreview } from '@/components/dashboard/reports/report-preview'

export default async function ReportsPage({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) redirect('/dashboard')

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId },
    select: { id: true, name: true, domain: true }
  })
  if (!site) redirect('/sites')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports — {site.name}</h1>
          <p className="text-gray-600">Preview, download, or send the latest report.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/sites/${site.id}`}>← Back</Link>
          </Button>
          <ReportPreview siteId={site.id} />
          <a className="btn btn-primary" href={`/api/sites/${site.id}/report`} target="_blank" rel="noreferrer">
            <Button>Download PDF</Button>
          </a>
          <form action={`/api/cron/send-reports`} method="post">
            <Button type="submit">Send Monthly Report</Button>
          </form>
        </div>
      </div>

      <div className="rounded border p-4">
        <p className="text-sm text-gray-600">Report history will appear here. For now, use the buttons above to preview, download, or send.</p>
      </div>
    </div>
  )
}
