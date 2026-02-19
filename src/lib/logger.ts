import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
})

/** Create a child logger scoped to an API request */
export function apiLogger(route: string, extra?: Record<string, unknown>) {
  return logger.child({ ctx: 'api', route, ...extra })
}

/** Create a child logger scoped to a cron job */
export function cronLogger(cron: string, extra?: Record<string, unknown>) {
  return logger.child({ ctx: 'cron', cron, ...extra })
}

/** Create a child logger scoped to a BullMQ worker/job */
export function jobLogger(queue: string, jobId?: string, extra?: Record<string, unknown>) {
  return logger.child({ ctx: 'worker', queue, jobId, ...extra })
}
