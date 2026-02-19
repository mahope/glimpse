import { cache } from 'react'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'server-init' })

export const serverInit = cache(async () => {
  // Validate encryption key length
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
    log.error('ENCRYPTION_KEY must be 32 bytes (ASCII). Set ENCRYPTION_KEY in environment for production security.')
  }

  if (!process.env.CRON_SECRET) {
    log.warn('CRON_SECRET not set; skipping register-on-boot')
    return
  }
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/register-on-boot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      log.warn({ response: await res.text() }, 'register-on-boot failed')
    } else {
      log.info('register-on-boot ok')
    }
  } catch (e) {
    log.warn({ err: e }, 'register-on-boot error')
  }
})
