'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toast } from '@/components/ui/toast'

interface Site {
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
  _count: {
    searchStatsDaily: number
    perfSnapshots: number
    seoScores: number
  }
}

interface SitesListProps {
  sites: Site[]
}

export function SitesList({ sites }: SitesListProps) {
  if (sites.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent className="space-y-4">
          <div className="text-6xl mb-4 opacity-30">&#127760;</div>
          <CardTitle className="text-xl text-muted-foreground">No Sites Connected</CardTitle>
          <CardDescription>
            Get started by connecting your first website to track its SEO performance
          </CardDescription>
          <Button asChild className="mt-6">
            <Link href="/sites/connect">Connect Your First Site</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sites.map((site) => (
        <Card key={site.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-1">{site.name}</CardTitle>
                <CardDescription className="break-all">
                  {site.domain}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end space-y-1">
                {site.gscConnectedAt ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    GSC Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    GSC Pending
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Site Statistics */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <div className="font-semibold text-lg text-blue-600">
                  {site._count.searchStatsDaily}
                </div>
                <div className="text-gray-600">GSC Records</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-green-600">
                  {site._count.perfSnapshots}
                </div>
                <div className="text-gray-600">Speed Tests</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-purple-600">
                  {site._count.seoScores}
                </div>
                <div className="text-gray-600">SEO Scores</div>
              </div>
            </div>

            {/* Site Info */}
            <div className="space-y-2 text-sm text-gray-600">
              {site.gscConnectedAt && (
                <div className="flex items-center justify-between">
                  <span>GSC Connected:</span>
                  <span>{new Date(site.gscConnectedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Added:</span>
                <span>{new Date(site.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button asChild variant="default" size="sm" className="flex-1">
                <Link href={`/sites/${site.id}`}>View Details</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/sites/${site.id}/performance`}>Performance</Link>
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <ManualJobTrigger siteId={site.id} siteName={site.name} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ManualJobTrigger({ siteId, siteName }: { siteId: string; siteName: string }) {
  const triggerGSCSync = async () => {
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'gsc-sync',
          siteId: siteId,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast('success', `GSC sync triggered for ${siteName}!`)
      } else {
        const error = await response.json()
        toast('error', `Failed to trigger GSC sync: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger GSC sync:', error)
      toast('error', 'Failed to trigger GSC sync')
    }
  }

  const triggerPerformanceTest = async () => {
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance-test',
          siteId: siteId,
          device: 'MOBILE',
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast('success', `Performance test triggered for ${siteName}!`)
      } else {
        const error = await response.json()
        toast('error', `Failed to trigger performance test: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger performance test:', error)
      toast('error', 'Failed to trigger performance test')
    }
  }

  return (
    <div className="flex gap-1">
      <Button onClick={triggerGSCSync} size="sm" variant="ghost" className="text-xs px-2">
        Sync GSC
      </Button>
      <Button onClick={triggerPerformanceTest} size="sm" variant="ghost" className="text-xs px-2">
        Test Speed
      </Button>
    </div>
  )
}