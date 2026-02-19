'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  recentCompleted: any[]
  recentFailed: any[]
}

interface JobStatus {
  queues: QueueStats[]
  timestamp: string
}

export function JobMonitor() {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggeringJob, setTriggeringJob] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [jobType, setJobType] = useState('')
  const [device, setDevice] = useState<'MOBILE' | 'DESKTOP'>('MOBILE')

  const fetchJobStatus = async () => {
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
  }

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
        toast('success', `Job triggered successfully! Job ID: ${result.jobId}`)
        fetchJobStatus() // Refresh status
      } else {
        const error = await response.json()
        toast('error', `Failed to trigger job: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger job:', error)
      toast('error', 'Failed to trigger job')
    } finally {
      setTriggeringJob(false)
    }
  }

  useEffect(() => {
    fetchJobStatus()
    const interval = setInterval(fetchJobStatus, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div>Loading job status...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Background Jobs Monitor</h2>
          <p className="text-gray-600">Monitor and manage background job queues</p>
        </div>
        <Button onClick={fetchJobStatus} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {jobStatus?.queues.map((queue) => (
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
            </CardContent>
          </Card>
        ))}
      </div>

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
                {/* You would fetch and populate sites here */}
                <SelectItem value="site1">Example Site 1</SelectItem>
                <SelectItem value="site2">Example Site 2</SelectItem>
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

      {/* Recent Job History */}
      {jobStatus?.queues.map((queue) => (
        <Card key={`history-${queue.name}`}>
          <CardHeader>
            <CardTitle>{queue.name} - Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queue.recentCompleted.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">Recent Completed Jobs</h4>
                  <div className="space-y-2">
                    {queue.recentCompleted.slice(0, 3).map((job) => (
                      <div key={job.id} className="text-sm bg-green-50 p-2 rounded">
                        <div className="font-medium">Job #{job.id}</div>
                        <div className="text-gray-600">
                          Completed: {new Date(job.finishedOn).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {queue.recentFailed.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Recent Failed Jobs</h4>
                  <div className="space-y-2">
                    {queue.recentFailed.slice(0, 3).map((job) => (
                      <div key={job.id} className="text-sm bg-red-50 p-2 rounded">
                        <div className="font-medium">Job #{job.id}</div>
                        <div className="text-gray-600">
                          Failed: {new Date(job.finishedOn).toLocaleString()}
                        </div>
                        <div className="text-red-600 text-xs mt-1">
                          {job.failedReason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {jobStatus && (
        <div className="text-sm text-gray-500 text-center">
          Last updated: {new Date(jobStatus.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  )
}