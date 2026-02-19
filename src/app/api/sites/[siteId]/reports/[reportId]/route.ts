import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

// GET: Download a specific report PDF
export async function GET(
  req: NextRequest,
  { params }: { params: { siteId: string; reportId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const report = await prisma.report.findFirst({
    where: { id: params.reportId, siteId: site.id },
  })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const safeFileName = report.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return new Response(report.pdfData, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeFileName}"`,
    },
  })
}

// DELETE: Delete a specific report
export async function DELETE(
  req: NextRequest,
  { params }: { params: { siteId: string; reportId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const report = await prisma.report.findFirst({
    where: { id: params.reportId, siteId: site.id },
  })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  await prisma.report.delete({ where: { id: report.id } })

  return NextResponse.json({ ok: true })
}
