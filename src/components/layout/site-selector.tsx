'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, ChevronDown } from "lucide-react"

// Mock data - replace with real API calls
const mockSites = [
  { id: '1', name: 'Example.com', domain: 'example.com', url: 'https://example.com' },
  { id: '2', name: 'Shop Site', domain: 'shop.example.com', url: 'https://shop.example.com' },
  { id: '3', name: 'Blog', domain: 'blog.example.com', url: 'https://blog.example.com' },
]

export function SiteSelector() {
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [sites, setSites] = useState(mockSites)

  useEffect(() => {
    // TODO: Fetch user's sites from API
    // For now, use mock data and select first site
    if (sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0].id)
    }
  }, [sites, selectedSite])

  const currentSite = sites.find(site => site.id === selectedSite)

  return (
    <div className="flex items-center space-x-2">
      <Globe className="h-4 w-4 text-gray-500" />
      <Select value={selectedSite} onValueChange={setSelectedSite}>
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
          <SelectItem value="">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span>All Sites</span>
            </div>
          </SelectItem>
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