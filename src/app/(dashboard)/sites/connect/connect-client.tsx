'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'

interface SiteInfo {
  id: string
  name: string
  domain: string
  url: string
  gscPropertyUrl: string | null
  gscConnectedAt: string | null
}

export function GSCConnectClient({ sites }: { sites: SiteInfo[] }) {
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [properties, setProperties] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/gsc/auth-url').then(r => r.json()).then(d => setAuthUrl(d.url)).catch(() => {})
  }, [])

  const startAuth = async () => {
    if (!authUrl) return
    window.location.href = authUrl
  }

  const fetchProperties = async (siteId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/gsc/properties`)
      const data = await res.json()
      setProperties(p => ({ ...p, [siteId]: data.properties || [] }))
    } finally {
      setLoading(false)
    }
  }

  const selectProperty = async (siteId: string, propertyUrl: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/gsc/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyUrl }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast('success', 'Connected! Backfilling last 90 days and scheduling daily sync...')
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Authorize Google Search Console</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={startAuth} disabled={!authUrl}>Connect Google</Button>
        </CardContent>
      </Card>
      {sites.map(site => (
        <Card key={site.id}>
          <CardHeader>
            <CardTitle>{site.name} ({site.domain})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {site.gscConnectedAt ? (
              <div className="text-green-700">Connected to: {site.gscPropertyUrl}</div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Button variant="outline" onClick={() => fetchProperties(site.id)} disabled={loading}>List My GSC Properties</Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(properties[site.id] || []).map(p => (
                    <Button key={p} size="sm" onClick={() => selectProperty(site.id, p)}>{p}</Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
