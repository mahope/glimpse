'use client'

import { useState, useEffect } from 'react'
import { ReportsTab } from './reports-tab'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { CrawlIssue } from '@/lib/crawler/types'

interface IssueData {
  issues: CrawlIssue[]
  issuesByUrl: Record<string, CrawlIssue[]>
  stats: {
    total: number
    byCategory: Record<string, number>
    bySeverity: {
      error: number
      warning: number
      info: number
    }
  }
  topIssues: Array<{
    category: string
    message: string
    count: number
    type: 'error' | 'warning' | 'info'
    recommendation?: string
  }>
  trend?: {
    current: number
    previous: number
    change: number
  }
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-100 text-red-800'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
}

const categoryLabels = {
  title: 'Title Tags',
  description: 'Meta Descriptions',
  headings: 'Headings',
  images: 'Images',
  content: 'Content',
  performance: 'Performance',
  technical: 'Technical',
  links: 'Links'
}

export default function IssuesPage() {
  const params = useParams()
  const siteId = params.siteId as string

  const [data, setData] = useState<IssueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped')
  const [crawling, setCrawling] = useState(false)

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedSeverity !== 'all') params.set('severity', selectedSeverity)

      const response = await fetch(`/api/sites/${siteId}/issues?${params}`)
      if (!response.ok) throw new Error('Failed to fetch issues')
      
      const issueData = await response.json()
      setData(issueData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const startCrawl = async () => {
    try {
      setCrawling(true)
      const response = await fetch(`/api/sites/${siteId}/crawl`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start crawl')
      }

      // Refresh issues after crawl
      setTimeout(() => {
        fetchIssues()
        setCrawling(false)
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start crawl')
      setCrawling(false)
    }
  }

  useEffect(() => {
    fetchIssues()
  }, [siteId, selectedCategory, selectedSeverity])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <Button 
            onClick={() => fetchIssues()} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const filteredIssues = data.issues.filter(issue => {
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false
    if (selectedSeverity !== 'all' && issue.type !== selectedSeverity) return false
    return true
  })

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-red-600" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-green-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">SEO Issues</h1>
        <Button 
          onClick={startCrawl}
          disabled={crawling}
          className="min-w-32"
        >
          {crawling ? 'Crawling...' : 'Start New Crawl'}
        </Button>
      </div>

      {/* Site sub-navigation */}
      {/* @ts-expect-error Client component in server file boundaries */}
      {(() => { return null })()}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold">{data.stats.total}</p>
              </div>
              {data.trend && (
                <div className="flex items-center text-sm">
                  {getTrendIcon(data.trend.change)}
                  <span className="ml-1">{data.trend.change}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical</p>
                <p className="text-2xl font-bold text-red-600">{data.stats.bySeverity.error}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">{data.stats.bySeverity.warning}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Info</p>
                <p className="text-2xl font-bold text-blue-600">{data.stats.bySeverity.info}</p>
              </div>
              <Info className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label} ({data.stats.byCategory[key] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="error">Critical ({data.stats.bySeverity.error})</SelectItem>
            <SelectItem value="warning">Warning ({data.stats.bySeverity.warning})</SelectItem>
            <SelectItem value="info">Info ({data.stats.bySeverity.info})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'grouped')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="View mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grouped">Grouped by Issue</SelectItem>
            <SelectItem value="list">List by Page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Issues */}
      {data.topIssues.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Most Common Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topIssues.slice(0, 5).map((issue, index) => {
                const config = severityConfig[issue.type]
                const Icon = config.icon
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${config.borderColor} ${config.bgColor}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <Icon className={`h-5 w-5 ${config.color} mt-0.5 mr-3`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={config.badgeColor}>
                              {categoryLabels[issue.category as keyof typeof categoryLabels]}
                            </Badge>
                            <span className="text-sm font-medium">
                              {issue.count} pages affected
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{issue.message}</p>
                          {issue.recommendation && (
                            <p className="text-xs text-gray-600">{issue.recommendation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Tab */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Crawl Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {/* @ts-expect-error Server/Client boundary */}
          <ReportsTab siteId={siteId} />
        </CardContent>
      </Card>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'grouped' ? 'Issues by Type' : 'Issues by Page'}
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({filteredIssues.length} issues)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredIssues.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No issues found matching your filters.</p>
              <Button 
                onClick={() => {
                  setSelectedCategory('all')
                  setSelectedSeverity('all')
                }}
                variant="outline"
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === 'list' ? (
                // List view - group by URL
                Object.entries(data.issuesByUrl)
                  .filter(([url, issues]) => 
                    issues.some(issue => {
                      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false
                      if (selectedSeverity !== 'all' && issue.type !== selectedSeverity) return false
                      return true
                    })
                  )
                  .map(([url, issues]) => {
                    const filteredPageIssues = issues.filter(issue => {
                      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false
                      if (selectedSeverity !== 'all' && issue.type !== selectedSeverity) return false
                      return true
                    })

                    return (
                      <div key={url} className="border rounded-lg p-4">
                        <h3 className="font-medium mb-2 text-blue-600 hover:underline">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {url}
                          </a>
                        </h3>
                        <div className="space-y-2">
                          {filteredPageIssues.map((issue, index) => {
                            const config = severityConfig[issue.type]
                            const Icon = config.icon
                            
                            return (
                              <div key={index} className="flex items-start text-sm">
                                <Icon className={`h-4 w-4 ${config.color} mt-0.5 mr-2`} />
                                <div className="flex-1">
                                  <Badge className={`${config.badgeColor} mr-2`} size="sm">
                                    {categoryLabels[issue.category as keyof typeof categoryLabels]}
                                  </Badge>
                                  <span className="text-gray-700">{issue.message}</span>
                                  {issue.element && (
                                    <div className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 p-1 rounded">
                                      {issue.element}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
              ) : (
                // Grouped view - show issues grouped by type
                filteredIssues.map((issue, index) => {
                  const config = severityConfig[issue.type]
                  const Icon = config.icon
                  
                  return (
                    <div key={index} className={`border rounded-lg p-4 ${config.borderColor}`}>
                      <div className="flex items-start">
                        <Icon className={`h-5 w-5 ${config.color} mt-0.5 mr-3`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={config.badgeColor}>
                              {categoryLabels[issue.category as keyof typeof categoryLabels]}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{issue.message}</p>
                          {issue.element && (
                            <div className="text-xs text-gray-500 mb-2 font-mono bg-gray-50 p-2 rounded">
                              {issue.element}
                            </div>
                          )}
                          {issue.recommendation && (
                            <p className="text-xs text-gray-600 mb-2">
                              <strong>Recommendation:</strong> {issue.recommendation}
                            </p>
                          )}
                          {issue.url && (
                            <a 
                              href={issue.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {issue.url}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}