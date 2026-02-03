'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'

interface SitePerformanceProps {
  site: {
    id: string
    name: string
    domain: string
    url: string
    performanceTests: Array<{
      id: string
      testUrl: string
      device: 'MOBILE' | 'DESKTOP'
      score: number | null
      lcp: number | null
      inp: number | null
      cls: number | null
      ttfb: number | null
      fcp: number | null
      speedIndex: number | null
      status: string
      errorMessage: string | null
      lighthouseVersion: string | null
      testDuration: number | null
      createdAt: Date
      updatedAt: Date
    }>
  }
}

export function SitePerformance({ site }: SitePerformanceProps) {
  const [selectedDevice, setSelectedDevice] = useState<'MOBILE' | 'DESKTOP' | 'ALL'>('ALL')
  
  const filteredTests = site.performanceTests.filter(test => 
    selectedDevice === 'ALL' || test.device === selectedDevice
  )

  const completedTests = filteredTests.filter(test => test.status === 'COMPLETED' && test.score !== null)
  
  // Prepare chart data
  const chartData = completedTests.slice(0, 20).reverse().map((test, index) => ({
    date: new Date(test.createdAt).toLocaleDateString(),
    score: test.score,
    lcp: test.lcp,
    cls: test.cls ? test.cls * 1000 : null, // Convert to milliseconds for better visualization
    ttfb: test.ttfb,
    device: test.device,
    testId: test.id,
  }))

  const latestTest = completedTests[0]

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 90) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number | null) => {
    if (!score) return 'secondary'
    if (score >= 90) return 'default' // Green
    if (score >= 50) return 'secondary' // Yellow
    return 'destructive' // Red
  }

  const triggerPerformanceTest = async (device: 'MOBILE' | 'DESKTOP') => {
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance-test',
          siteId: site.id,
          device: device,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Performance test triggered for ${device}! Job ID: ${result.jobId}`)
      } else {
        const error = await response.json()
        alert(`Failed to trigger performance test: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger performance test:', error)
      alert('Failed to trigger performance test')
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedDevice} onValueChange={(value) => setSelectedDevice(value as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Devices</SelectItem>
              <SelectItem value="MOBILE">Mobile Only</SelectItem>
              <SelectItem value="DESKTOP">Desktop Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-gray-600">
            {completedTests.length} completed tests
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => triggerPerformanceTest('MOBILE')} size="sm">
            Test Mobile
          </Button>
          <Button onClick={() => triggerPerformanceTest('DESKTOP')} size="sm" variant="outline">
            Test Desktop
          </Button>
        </div>
      </div>

      {/* Latest Test Summary */}
      {latestTest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Latest Performance Test
              <Badge variant={getScoreBadgeVariant(latestTest.score)}>
                {latestTest.device}
              </Badge>
            </CardTitle>
            <CardDescription>
              {new Date(latestTest.createdAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(latestTest.score)}`}>
                  {latestTest.score || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-orange-600">
                  {latestTest.lcp ? `${latestTest.lcp.toFixed(2)}s` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">LCP</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-purple-600">
                  {latestTest.inp ? `${latestTest.inp.toFixed(0)}ms` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">INP</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-600">
                  {latestTest.cls ? latestTest.cls.toFixed(3) : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">CLS</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-green-600">
                  {latestTest.ttfb ? `${latestTest.ttfb.toFixed(0)}ms` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">TTFB</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-indigo-600">
                  {latestTest.fcp ? `${latestTest.fcp.toFixed(2)}s` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">FCP</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Score Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Score Trend</CardTitle>
            <CardDescription>
              Overall PageSpeed score over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-3 border rounded shadow-lg">
                            <p className="font-semibold">{label}</p>
                            <p className="text-sm text-gray-600">{data.device}</p>
                            <p className="text-lg font-bold text-blue-600">
                              Score: {data.score}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Web Vitals Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals Trend</CardTitle>
            <CardDescription>
              LCP (seconds), TTFB (milliseconds) over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="lcp" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    name="LCP (s)"
                    dot={{ fill: '#f97316', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ttfb" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="TTFB (ms)"
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Test History</CardTitle>
          <CardDescription>
            Complete history of performance tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Device</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Score</th>
                    <th className="text-right p-2">LCP</th>
                    <th className="text-right p-2">CLS</th>
                    <th className="text-right p-2">TTFB</th>
                    <th className="text-right p-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.slice(0, 20).map((test) => (
                    <tr key={test.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{new Date(test.createdAt).toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {test.device}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge 
                          variant={test.status === 'COMPLETED' ? 'default' : 
                                  test.status === 'FAILED' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {test.status}
                        </Badge>
                      </td>
                      <td className={`p-2 text-right font-medium ${getScoreColor(test.score)}`}>
                        {test.score || '-'}
                      </td>
                      <td className="p-2 text-right">
                        {test.lcp ? `${test.lcp.toFixed(2)}s` : '-'}
                      </td>
                      <td className="p-2 text-right">
                        {test.cls ? test.cls.toFixed(3) : '-'}
                      </td>
                      <td className="p-2 text-right">
                        {test.ttfb ? `${test.ttfb.toFixed(0)}ms` : '-'}
                      </td>
                      <td className="p-2 text-right text-gray-600">
                        {test.testDuration ? `${(test.testDuration / 1000).toFixed(1)}s` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No performance tests available for this site
              <div className="mt-4">
                <Button onClick={() => triggerPerformanceTest('MOBILE')} size="sm">
                  Run First Test
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}