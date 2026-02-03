import { PerfDevice, AlertMetric } from '@prisma/client'

export type RuleInput = {
  id?: string
  siteId: string
  metric: AlertMetric
  device: PerfDevice
  threshold: number
  windowDays?: number
  enabled?: boolean
  recipients: string[]
}

export type SeriesPoint = {
  date: Date
  device: PerfDevice
  lcpPctl?: number | null
  inpPctl?: number | null
  clsPctl?: number | null
  perfScoreAvg?: number | null
}

export type EvalResult = {
  violated: boolean
  value?: number
  reason?: string
}
