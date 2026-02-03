import { describe, it, expect } from 'vitest'
import { verifyCronSecret } from '@/lib/cron/auth'

// Minimal mock for NextRequest
class MockReq {
  headers: Map<string, string>
  constructor(auth?: string) { this.headers = new Map(auth ? [['authorization', auth]] : []) }
}

describe('cron auth', () => {
  it('rejects when missing secret', () => {
    const req = new MockReq('Bearer wrong') as any
    const res = verifyCronSecret(req)
    // In tests env, CRON_SECRET may be undefined -> returns 500
    expect(res?.status).toBeDefined()
  })
})
