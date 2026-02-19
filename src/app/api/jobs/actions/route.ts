import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'
import { Queue } from 'bullmq'
import { gscSyncQueue, performanceQueue, crawlQueue, scoreQueue, uptimeCheckQueue } from '@/lib/jobs/queue'
import { apiLogger } from '@/lib/logger'

const log = apiLogger('/api/jobs/actions')

const queues: Record<string, Queue> = {
  'gsc-sync': gscSyncQueue,
  'performance-test': performanceQueue,
  'site-crawl': crawlQueue,
  'score-calculation': scoreQueue,
  'uptime-check': uptimeCheckQueue,
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('retry'),
    queue: z.string(),
    jobId: z.string(),
  }),
  z.object({
    action: z.literal('remove'),
    queue: z.string(),
    jobId: z.string(),
  }),
  z.object({
    action: z.literal('clean'),
    queue: z.string(),
    status: z.enum(['completed', 'failed', 'delayed', 'wait']),
    grace: z.number().int().min(0).default(0),
  }),
  z.object({
    action: z.literal('inspect'),
    queue: z.string(),
    jobId: z.string(),
  }),
])

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const queue = queues[data.queue]
    if (!queue) {
      return NextResponse.json({ error: `Unknown queue: ${data.queue}` }, { status: 400 })
    }

    switch (data.action) {
      case 'retry': {
        const job = await queue.getJob(data.jobId)
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }
        const state = await job.getState()
        if (state !== 'failed') {
          return NextResponse.json({ error: `Cannot retry job in '${state}' state — only failed jobs can be retried` }, { status: 409 })
        }
        await job.retry()
        log.info({ queue: data.queue, jobId: data.jobId }, 'Job retried')
        return NextResponse.json({ ok: true, action: 'retry', jobId: data.jobId })
      }

      case 'remove': {
        const job = await queue.getJob(data.jobId)
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }
        await job.remove()
        log.info({ queue: data.queue, jobId: data.jobId }, 'Job removed')
        return NextResponse.json({ ok: true, action: 'remove', jobId: data.jobId })
      }

      case 'clean': {
        const removed = await queue.clean(data.grace, 1000, data.status)
        log.info({ queue: data.queue, status: data.status, count: removed.length }, 'Queue cleaned')
        return NextResponse.json({ ok: true, action: 'clean', removed: removed.length })
      }

      case 'inspect': {
        const job = await queue.getJob(data.jobId)
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }
        const state = await job.getState()
        return NextResponse.json({
          id: job.id,
          name: job.name,
          data: job.data,
          opts: {
            attempts: job.opts?.attempts,
            delay: job.opts?.delay,
            priority: job.opts?.priority,
            repeat: job.opts?.repeat,
            backoff: job.opts?.backoff,
          },
          state,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          timestamp: job.timestamp,
        })
      }
    }
  } catch (error) {
    log.error({ err: error }, 'Job action failed')
    return NextResponse.json({ error: 'Job action failed' }, { status: 500 })
  }
}
