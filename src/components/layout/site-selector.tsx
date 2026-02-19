'use client'

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, Loader2 } from "lucide-react"

interface Site {
  id: string
  name: string
  domain: string
  url: string
}

function extractSiteIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/sites\/([^/]+)/)
  return match ? match[1] : null
}

export function SiteSelector() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  const currentSiteId = extractSiteIdFromPath(pathname)

  useEffect(() => {
    let cancelled = false
    async function fetchSites() {
      try {
        const res = await fetch('/api/sites')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setSites(Array.isArray(data) ? data : data.sites ?? [])
        }
      } catch {
        // silently fail — selector stays empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSites()
    return () => { cancelled = true }
  }, [])

  const handleSiteChange = (siteId: string) => {
    if (!siteId) {
      router.push('/sites')
      return
    }
    // Navigate to the same sub-page under the new site, or default to overview
    const subPath = pathname.match(/\/sites\/[^/]+\/(.+)/)
    const suffix = subPath ? `/${subPath[1]}` : '/overview'
    router.push(`/sites/${siteId}${suffix}`)
  }

  const currentSite = sites.find(s => s.id === currentSiteId)

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading sites...</span>
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Globe className="h-4 w-4" />
        <span className="text-sm">No sites</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <Globe className="h-4 w-4 text-gray-500" />
      <Select value={currentSiteId ?? ''} onValueChange={handleSiteChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a site">
            {currentSite ? (
              <div className="flex flex-col items-start">
                <span className="font-medium">{currentSite.name}</span>
                <span className="text-xs text-gray-500">{currentSite.domain}</span>
              </div>
            ) : (
              'Select a site'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              <div className="flex flex-col items-start">
                <span className="font-medium">{site.name}</span>
                <span className="text-xs text-gray-500">{site.domain}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
