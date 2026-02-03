import { cache } from 'react'

export const serverInit = cache(async () => {
  // Validate encryption key length
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
    console.error('ENCRYPTION_KEY must be 32 bytes (ASCII). Set ENCRYPTION_KEY in environment for production security.')
  }

  if (!process.env.CRON_SECRET) {
    console.warn('CRON_SECRET not set; skipping register-on-boot')
    return
  }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/register-on-boot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('register-on-boot failed', await res.text())
    } else {
      console.log('register-on-boot ok')
    }
  } catch (e) {
    console.warn('register-on-boot error', e)
  }
})
