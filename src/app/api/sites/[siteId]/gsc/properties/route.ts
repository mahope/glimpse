import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { google } from 'googleapis'

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const site = await prisma.site.findFirst({ where: { id: params.siteId, organizationId } })
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get tokens from cookie set during OAuth
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/gsc_tokens=([^;]+)/)
  if (!match) return NextResponse.json({ error: 'Missing OAuth tokens' }, { status: 400 })
  const tokens = JSON.parse(decodeURIComponent(match[1]))

  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`)
  client.setCredentials({ refresh_token: tokens.refresh_token })
  const webmasters = google.webmasters({ version: 'v3', auth: client })
  const resp = await webmasters.sites.list({})
  const properties = (resp.data.siteEntry || []).map(e => e.siteUrl as string)
  return NextResponse.json({ properties })
}
