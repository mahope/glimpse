import { describe, it, expect } from 'vitest'
import { gscSyncQueue, performanceQueue, crawlQueue, scoreQueue } from '@/lib/jobs/queue'

describe('queue helpers', () => {
  it('queues exist and have backoff configured', async () => {
    expect(gscSyncQueue).toBeTruthy()
    expect(performanceQueue).toBeTruthy()
    expect(crawlQueue).toBeTruthy()
    expect(scoreQueue).toBeTruthy()

    const opts = (gscSyncQueue as any).opts?.defaultJobOptions
    expect(opts?.backoff).toBeTruthy()
    expect((performanceQueue as any).opts?.defaultJobOptions?.backoff).toBeTruthy()
  })
})
