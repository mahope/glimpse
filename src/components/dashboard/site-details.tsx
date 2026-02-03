'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClicksChart } from '@/components/charts/clicks-chart'
import { PositionChart } from '@/components/charts/position-chart'
import { PerformanceOverview } from './performance-overview'
import { TopKeywords } from './top-keywords'
import { TopPages } from './top-pages'

interface SiteDetailsProps {
  site: {
    id: string
    name: string
    domain: string
    url: string
    gscPropertyUrl: string | null
    gscConnectedAt: Date | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    organization: {
      name: string
      slug: string
    }
    searchConsoleData: Array<{
      id: string
      date: Date
      query: string | null
      page: string | null
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    performanceTests: Array<{
      id: string
      testUrl: string
      device: 'MOBILE' | 'DESKTOP'
      score: number | null
      lcp: number | null
      inp: number | null
      cls: number | null
      ttfb: number | null
      status: string
      createdAt: Date
    }>
    seoScores: Array<{
      id: string
      date: Date
      score: number
      clickTrend: number
      positionTrend: number
      impressionTrend: number
      ctrBenchmark: number
      performanceScore: number | null
    }>
  }
}

export function SiteDetails({ site }: SiteDetailsProps) {
  const latestSeoScore = site.seoScores[0]
  const latestPerformanceTest = site.performanceTests[0]

  return (
    <div className="space-y-6">
      {/* Site Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Site Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Site Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <Badge variant={site.isActive ? 'default' : 'secondary'}>
                {site.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">GSC Status:</span>
              <Badge variant={site.gscConnectedAt ? 'default' : 'secondary'}>
                {site.gscConnectedAt ? 'Connected' : 'Pending'}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">URL:</div>
              <a 
                href={site.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {site.url}
              </a>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Organization:</div>
              <div className="font-medium">{site.organization.name}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Added:</div>
              <div className="font-medium">{new Date(site.createdAt).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>

        {/* SEO Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            {latestSeoScore ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {latestSeoScore.score}
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(latestSeoScore.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Click Trend:</span>
                    <span className="ml-2 font-medium">{latestSeoScore.clickTrend}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <span className="ml-2 font-medium">{latestSeoScore.positionTrend}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Impressions:</span>
                    <span className="ml-2 font-medium">{latestSeoScore.impressionTrend}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">CTR:</span>
                    <span className="ml-2 font-medium">{latestSeoScore.ctrBenchmark}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No SEO scores available
                <div className="mt-2">
                  <Button size="sm" variant="outline">
                    Calculate Score
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {latestPerformanceTest ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {latestPerformanceTest.score || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {latestPerformanceTest.device} • {new Date(latestPerformanceTest.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {latestPerformanceTest.lcp && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>LCP:</span>
                      <span className="font-medium">{latestPerformanceTest.lcp.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CLS:</span>
                      <span className="font-medium">{latestPerformanceTest.cls?.toFixed(3) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TTFB:</span>
                      <span className="font-medium">{latestPerformanceTest.ttfb?.toFixed(0) || 'N/A'}ms</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No performance tests available
                <div className="mt-2">
                  <Button size="sm" variant="outline">
                    Run Test
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClicksChart />
        <PositionChart />
      </div>

      {/* Performance Overview */}
      <PerformanceOverview />

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopKeywords />
        <TopPages />
      </div>

      {/* Raw Data Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Search Console Data</CardTitle>
          <CardDescription>
            Latest GSC data for this site (showing top 20 records)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {site.searchConsoleData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Query</th>
                    <th className="text-left p-2">Page</th>
                    <th className="text-right p-2">Clicks</th>
                    <th className="text-right p-2">Impressions</th>
                    <th className="text-right p-2">CTR</th>
                    <th className="text-right p-2">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {site.searchConsoleData.slice(0, 20).map((data) => (
                    <tr key={data.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{new Date(data.date).toLocaleDateString()}</td>
                      <td className="p-2 max-w-xs truncate">{data.query || '-'}</td>
                      <td className="p-2 max-w-xs truncate">{data.page || '-'}</td>
                      <td className="p-2 text-right">{data.clicks}</td>
                      <td className="p-2 text-right">{data.impressions}</td>
                      <td className="p-2 text-right">{(data.ctr * 100).toFixed(2)}%</td>
                      <td className="p-2 text-right">{data.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No search console data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}