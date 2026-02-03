import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createDefaultGSCDataSyncService } from '@/lib/gsc/sync'

// Server component: shows user's sites and a button to connect GSC via Google OAuth
// After OAuth, we show property picker and store selection

export default async function ConnectSitePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  const organizationId = session.session.activeOrganizationId
  if (!organizationId) {
    redirect('/dashboard')
  }

  const sites = await prisma.site.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Connect Google Search Console</h1>
      <p className="text-gray-600">Authorize access and select the property that matches each site.</p>
      <GSCConnectClient sites={sites.map(s => ({ id: s.id, name: s.name, domain: s.domain, url: s.url, gscPropertyUrl: s.gscPropertyUrl, gscConnectedAt: s.gscConnectedAt }))} />
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function GSCConnectClient({ sites }: { sites: Array<{ id: string; name: string; domain: string; url: string; gscPropertyUrl: string | null; gscConnectedAt: Date | null }> }) {
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [properties, setProperties] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // preload auth url
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
      alert('Connected! Backfilling last 90 days and scheduling daily sync...')
    } catch (e: any) {
      alert(e.message)
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
