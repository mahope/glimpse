import { Queue, Job } from 'bullmq'
import { redisConnection } from './queue'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'dead-letter' })

export const deadLetterQueue = new Queue('dead-letter', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
})

const DLQ_ALERT_THRESHOLD = Number(process.env.DLQ_ALERT_THRESHOLD || '10')

/**
 * Move a permanently failed job to the dead letter queue.
 * Call this from a worker's `onFailed` handler when all attempts are exhausted.
 */
export async function moveToDeadLetter(job: Job | undefined, error: Error) {
  if (!job) return

  const isLastAttempt = job.attemptsMade >= (job.opts?.attempts ?? 1)
  if (!isLastAttempt) return

  const dlqData = {
    originalQueue: job.queueName,
    originalJobId: job.id,
    originalJobName: job.name,
    data: job.data,
    error: error.message,
    stack: error.stack,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
  }

  await deadLetterQueue.add('failed-job', dlqData, {
    jobId: `dlq:${job.queueName}:${job.id}:${Date.now()}`,
  })

  log.warn(
    { queue: job.queueName, jobId: job.id, attempts: job.attemptsMade, err: error },
    'Job moved to dead letter queue'
  )

  // Check DLQ depth and alert if threshold exceeded
  await checkDLQDepthAndAlert()
}

async function checkDLQDepthAndAlert() {
  try {
    const waiting = await deadLetterQueue.getWaitingCount()
    if (waiting < DLQ_ALERT_THRESHOLD) return

    // Debounce: only alert once per hour via Redis key
    const debounceKey = 'dlq:alert:sent'
    const redis = redisConnection
    const alreadySent = await redis.get(debounceKey)
    if (alreadySent) return
    await redis.set(debounceKey, '1', 'EX', 3600)

    log.error({ depth: waiting, threshold: DLQ_ALERT_THRESHOLD }, 'DLQ depth exceeds threshold')

    // Send email alert to admin
    try {
      const { sendEmail } = await import('@/lib/email/client')
      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail) return

      await sendEmail({
        to: adminEmail,
        subject: `[Glimpse] Dead Letter Queue alert: ${waiting} failed jobs`,
        text: [
          `The Glimpse dead letter queue has ${waiting} failed jobs (threshold: ${DLQ_ALERT_THRESHOLD}).`,
          '',
          'Please inspect the DLQ in the admin dashboard at /dashboard/jobs.',
          '',
          `Timestamp: ${new Date().toISOString()}`,
        ].join('\n'),
      })
      log.info({ to: adminEmail, depth: waiting }, 'DLQ alert email sent')
    } catch (emailErr) {
      log.error({ err: emailErr }, 'Failed to send DLQ alert email')
    }
  } catch (err) {
    log.error({ err }, 'Failed to check DLQ depth')
  }
}

/** Get current DLQ stats for the admin dashboard */
export async function getDLQStats() {
  const waiting = await deadLetterQueue.getWaitingCount()
  const jobs = await deadLetterQueue.getJobs(['waiting'], 0, 50)
  return {
    count: waiting,
    jobs: jobs.map(j => ({
      id: j.id,
      originalQueue: j.data?.originalQueue,
      originalJobId: j.data?.originalJobId,
      jobName: j.data?.originalJobName,
      error: j.data?.error,
      attempts: j.data?.attemptsMade,
      failedAt: j.data?.failedAt,
    })),
  }
}
