import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { buildReportData } from '@/lib/reports/build-report-data'
import { apiLogger } from '@/lib/logger'
import type { ReportSectionKey } from '@/lib/reports/types'

const log = apiLogger('/api/sites/[siteId]/report')

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  try {
  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId },
    include: { organization: true },
  })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sections = Array.isArray(site.reportSections) ? site.reportSections as ReportSectionKey[] : undefined
  const data = await buildReportData(site, sections)

  // Return JSON if requested (for in-browser preview)
  const { searchParams: sp } = new URL(req.url)
  if (sp.get('format') === 'json') {
    return NextResponse.json(data)
  }

  const buffer = await renderReportPDF(data)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${site.domain}-latest.pdf"`
    }
  })
  } catch (err) {
    log.error({ err }, 'Report route error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
