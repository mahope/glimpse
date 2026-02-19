import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`
  const code = new URL(req.url).searchParams.get('code')
  if (!code) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/sites/connect?error=missing_code`)
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  const { tokens } = await oauth2Client.getToken(code)
  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/sites/connect?error=no_refresh_token`)
  }
  // Store encrypted refresh token in cookie temporarily to use on connect per-site
  const enc = encrypt(JSON.stringify({ refresh_token: tokens.refresh_token }))
  ;(await cookies()).set('gsc_tokens', enc, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 })
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/sites/connect?connected=1`)
}
