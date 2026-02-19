import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyCronSecret = vi.fn()
const mockFindMany = vi.fn()
const mockScoreJob = vi.fn()

vi.mock('@/lib/cron/auth', () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    site: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock('@/lib/jobs/queue', () => ({
  scheduleJob: {
    scoreCalculation: (...args: unknown[]) => mockScoreJob(...args),
  },
}))

import { POST } from '@/app/api/cron/calculate-scores/route'

function cronReq() {
  return new Request('http://localhost/api/cron/calculate-scores', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  }) as any
}

describe('POST /api/cron/calculate-scores', () => {
  beforeEach(() => {
    mockVerifyCronSecret.mockReset()
    mockFindMany.mockReset()
    mockScoreJob.mockReset()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('rejects unauthorized requests', async () => {
    mockVerifyCronSecret.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )
    const res = await POST(cronReq())
    expect(res.status).toBe(401)
  })

  it('enqueues score calculation for each active site', async () => {
    mockVerifyCronSecret.mockReturnValue(null)
    mockFindMany.mockResolvedValue([
      { id: 's1', organizationId: 'org1' },
      { id: 's2', organizationId: 'org1' },
    ])
    mockScoreJob.mockResolvedValue({})

    const res = await POST(cronReq())
    const body = await res.json()

    expect(body.enqueued).toBe(2)
    expect(mockScoreJob).toHaveBeenCalledTimes(2)
  })

  it('is idempotent — second call enqueues same jobs', async () => {
    mockVerifyCronSecret.mockReturnValue(null)
    mockFindMany.mockResolvedValue([{ id: 's1', organizationId: 'org1' }])
    mockScoreJob.mockResolvedValue({})

    await POST(cronReq())
    await POST(cronReq())

    // Each call enqueues one job
    expect(mockScoreJob).toHaveBeenCalledTimes(2)
  })
})
