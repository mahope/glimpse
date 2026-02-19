import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'Missing Google OAuth env' }, { status: 500 })
  const returnTo = new URL(req.url).searchParams.get('returnTo')
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/webmasters.readonly'],
    prompt: 'consent',
    state: returnTo === 'onboarding' ? 'onboarding' : undefined,
  })
  return NextResponse.json({ url })
}
