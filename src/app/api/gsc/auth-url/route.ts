import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'Missing Google OAuth env' }, { status: 500 })
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/webmasters.readonly'],
    prompt: 'consent'
  })
  return NextResponse.json({ url })
}
