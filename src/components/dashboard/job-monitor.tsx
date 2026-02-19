'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'

interface JobInfo {
  id: string
  name?: string
  data?: Record<string, unknown>
  processedOn?: number
  finishedOn?: number
  failedReason?: string
  returnvalue?: unknown
}

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  recentCompleted: JobInfo[]
  recentFailed: JobInfo[]
}

interface DLQStats {
  count: number
  jobs: JobInfo[]
}

interface JobStatus {
  queues: QueueStats[]
  deadLetter: DLQStats
  timestamp: string
}

interface InspectedJob {
  id: string
  name: string
  data: Record<string, unknown>
  state: string
  progress: number
  attemptsMade: number
  failedReason: string | null
  stacktrace: string[]
  processedOn: number | null
  finishedOn: number | null
  timestamp: number
}

interface SiteOption {
  id: string
  name: string
  domain: string
}

const QUEUE_KEYS: Record<string, string> = {
  'GSC Sync': 'gsc-sync',
  'Performance Tests': 'performance-test',
  'Site Crawls': 'site-crawl',
  'Score Calculations': 'score-calculation',
  'Uptime Checks': 'uptime-check',
}

export function JobMonitor() {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggeringJob, setTriggeringJob] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [jobType, setJobType] = useState('')
  const [device, setDevice] = useState<'MOBILE' | 'DESKTOP'>('MOBILE')
  const [sites, setSites] = useState<SiteOption[]>([])
  const [inspectedJob, setInspectedJob] = useState<InspectedJob | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs/status')
      if (response.ok) {
        const data = await response.json()
        setJobStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch('/api/sites')
      if (response.ok) {
        const data = await response.json()
        setSites(Array.isArray(data.sites) ? data.sites : [])
      }
    } catch {
      // Sites fetch is best-effort
    }
  }, [])

  const triggerManualJob = async () => {
    if (!selectedSiteId || !jobType) return

    setTriggeringJob(true)
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: jobType,
          siteId: selectedSiteId,
          device: jobType === 'performance-test' ? device : undefined,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast('success', `Job triggered! ID: ${result.jobId}`)
        fetchJobStatus()
      } else {
        const error = await response.json()
        toast('error', `Failed: ${error.error}`)
      }
    } catch {
      toast('error', 'Failed to trigger job')
    } finally {
      setTriggeringJob(false)
    }
  }

  const performAction = async (action: string, queueName: string, jobId?: string, extra?: Record<string, unknown>) => {
    const loadingKey = `${action}:${queueName}:${jobId || 'all'}`
    setActionLoading(loadingKey)
    try {
      const response = await fetch('/api/jobs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queue: queueName, jobId, ...extra }),
      })

      if (response.ok) {
        const result = await response.json()
        if (action === 'inspect') {
          setInspectedJob(result)
        } else {
          toast('success', action === 'clean'
            ? `Cleaned ${result.removed} jobs`
            : `Job ${action}d successfully`)
          fetchJobStatus()
        }
      } else {
        const error = await response.json()
        toast('error', error.error || `Action failed`)
      }
    } catch {
      toast('error', `Failed to ${action} job`)
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    fetchJobStatus()
    fetchSites()
    const interval = setInterval(fetchJobStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchJobStatus, fetchSites])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Loading job status...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Background Jobs Monitor</h2>
          <p className="text-muted-foreground">Monitor and manage background job queues</p>
        </div>
        <Button onClick={fetchJobStatus} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {jobStatus?.queues.map((queue) => {
          const queueKey = QUEUE_KEYS[queue.name] || ''
          return (
            <Card key={queue.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{queue.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Active:</span>
                  <span className="font-medium">{queue.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">Waiting:</span>
                  <span className="font-medium">{queue.waiting}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Completed:</span>
                  <span className="font-medium">{queue.completed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Failed:</span>
                  <span className="font-medium">{queue.failed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600">Delayed:</span>
                  <span className="font-medium">{queue.delayed}</span>
                </div>
                {queue.failed > 0 && (
                  <div className="flex gap-1 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 flex-1"
                      onClick={() => performAction('clean', queueKey, undefined, { status: 'failed', grace: 0 })}
                      disabled={actionLoading !== null}
                    >
                      Clear Failed
                    </Button>
                  </div>
                )}
                {queue.completed > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 w-full"
                    onClick={() => performAction('clean', queueKey, undefined, { status: 'completed', grace: 0 })}
                    disabled={actionLoading !== null}
                  >
                    Clear Completed
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dead Letter Queue */}
      {jobStatus?.deadLetter && jobStatus.deadLetter.count > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Dead Letter Queue ({jobStatus.deadLetter.count})</CardTitle>
            <CardDescription>Permanently failed jobs that exhausted all retries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobStatus.deadLetter.jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded flex justify-between items-start">
                  <div>
                    <div className="font-medium">Job #{job.id}</div>
                    {job.failedReason && (
                      <div className="text-red-600 text-xs mt-1">{job.failedReason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Job Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Job Trigger</CardTitle>
          <CardDescription>
            Trigger background jobs manually for testing or immediate execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={jobType} onValueChange={setJobType}>
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gsc-sync">GSC Sync</SelectItem>
                <SelectItem value="performance-test">Performance Test</SelectItem>
                <SelectItem value="site-crawl">Site Crawl</SelectItem>
                <SelectItem value="score-calculation">Score Calculation</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name || site.domain}
                  </SelectItem>
                ))}
                {sites.length === 0 && (
                  <SelectItem value="" disabled>No sites found</SelectItem>
                )}
              </SelectContent>
            </Select>

            {jobType === 'performance-test' && (
              <Select value={device} onValueChange={(value) => setDevice(value as 'MOBILE' | 'DESKTOP')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOBILE">Mobile</SelectItem>
                  <SelectItem value="DESKTOP">Desktop</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={triggerManualJob}
              disabled={triggeringJob || !jobType || !selectedSiteId}
            >
              {triggeringJob ? 'Triggering...' : 'Trigger Job'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Inspector Modal */}
      {inspectedJob && (
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Job Inspector: #{inspectedJob.id}</CardTitle>
              <CardDescription>{inspectedJob.name} — State: {inspectedJob.state}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setInspectedJob(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Attempts:</span> {inspectedJob.attemptsMade}
              </div>
              {inspectedJob.failedReason && (
                <div>
                  <span className="font-medium text-red-600">Failed Reason:</span>
                  <pre className="mt-1 text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-x-auto">{inspectedJob.failedReason}</pre>
                </div>
              )}
              {inspectedJob.stacktrace.length > 0 && (
                <div>
                  <span className="font-medium">Stacktrace:</span>
                  <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-48">
                    {inspectedJob.stacktrace.join('\n')}
                  </pre>
                </div>
              )}
              <div>
                <span className="font-medium">Job Data:</span>
                <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-48">
                  {JSON.stringify(inspectedJob.data, null, 2)}
                </pre>
              </div>
              {inspectedJob.processedOn && (
                <div>
                  <span className="font-medium">Processed:</span> {new Date(inspectedJob.processedOn).toLocaleString()}
                </div>
              )}
              {inspectedJob.finishedOn && (
                <div>
                  <span className="font-medium">Finished:</span> {new Date(inspectedJob.finishedOn).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Job History per Queue */}
      {jobStatus?.queues.map((queue) => {
        const queueKey = QUEUE_KEYS[queue.name] || ''
        const hasActivity = queue.recentCompleted.length > 0 || queue.recentFailed.length > 0
        if (!hasActivity) return null

        return (
          <Card key={`history-${queue.name}`}>
            <CardHeader>
              <CardTitle>{queue.name} — Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {queue.recentFailed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Failed Jobs</h4>
                    <div className="space-y-2">
                      {queue.recentFailed.slice(0, 5).map((job) => (
                        <div key={job.id} className="text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Job #{job.id}</div>
                            {job.finishedOn && (
                              <div className="text-muted-foreground text-xs">
                                Failed: {new Date(job.finishedOn).toLocaleString()}
                              </div>
                            )}
                            {job.failedReason && (
                              <div className="text-red-600 text-xs mt-1 truncate">{job.failedReason}</div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => performAction('inspect', queueKey, job.id)}
                              disabled={actionLoading !== null}
                            >
                              Inspect
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => performAction('retry', queueKey, job.id)}
                              disabled={actionLoading !== null}
                            >
                              Retry
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-red-600"
                              onClick={() => performAction('remove', queueKey, job.id)}
                              disabled={actionLoading !== null}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {queue.recentCompleted.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Completed Jobs</h4>
                    <div className="space-y-2">
                      {queue.recentCompleted.slice(0, 3).map((job) => (
                        <div key={job.id} className="text-sm bg-green-50 dark:bg-green-950/20 p-3 rounded flex justify-between items-center">
                          <div>
                            <div className="font-medium">Job #{job.id}</div>
                            {job.finishedOn && (
                              <div className="text-muted-foreground text-xs">
                                Completed: {new Date(job.finishedOn).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            onClick={() => performAction('inspect', queueKey, job.id)}
                            disabled={actionLoading !== null}
                          >
                            Inspect
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {jobStatus && (
        <div className="text-sm text-muted-foreground text-center">
          Last updated: {new Date(jobStatus.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  )
}
