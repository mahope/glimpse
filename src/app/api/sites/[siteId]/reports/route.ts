import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { renderReportPDF } from '@/lib/reports/pdf-generator'
import { buildReportData } from '@/lib/reports/build-report-data'
import { z } from 'zod'

// GET: List report history for a site
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reports = await prisma.report.findMany({
    where: { siteId: site.id },
    select: { id: true, type: true, status: true, generatedAt: true, fileName: true, sentTo: true, createdAt: true },
    orderBy: { generatedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ reports, schedule: site.reportSchedule })
}

// POST: Generate a report on-demand
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organizationId },
    include: { organization: true },
  })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const data = await buildReportData(site)
    const pdf = await renderReportPDF(data)
    const fileName = `${site.domain}-${new Date().toISOString().slice(0, 10)}.pdf`

    const report = await prisma.report.create({
      data: {
        siteId: site.id,
        type: 'on-demand',
        status: 'completed',
        fileName,
        pdfData: Buffer.from(pdf),
        sentTo: [],
      },
    })

    return NextResponse.json({
      id: report.id,
      type: report.type,
      status: report.status,
      generatedAt: report.generatedAt,
      fileName: report.fileName,
    })
  } catch (err) {
    console.error('Failed to generate report:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

// PATCH: Update report schedule
const ScheduleSchema = z.object({
  schedule: z.enum(['NONE', 'WEEKLY', 'MONTHLY']),
})

export async function PATCH(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ScheduleSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 })

  await prisma.site.update({
    where: { id: site.id },
    data: { reportSchedule: parsed.data.schedule },
  })

  return NextResponse.json({ schedule: parsed.data.schedule })
}
