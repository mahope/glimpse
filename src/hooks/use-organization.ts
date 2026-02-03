'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'

interface Organization {
  id: string
  name: string
  slug: string
  logo: string | null
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

interface UseOrganizationReturn {
  organizations: Organization[]
  activeOrganization: Organization | null
  isLoading: boolean
  error: string | null
  setActiveOrganization: (orgId: string) => Promise<void>
}

export function useOrganization(): UseOrganizationReturn {
  const { data: session, isLoading: sessionLoading } = useSession()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeOrganization, setActiveOrganizationState] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionLoading) return

    if (!session?.user) {
      setIsLoading(false)
      return
    }

    fetchOrganizations()
  }, [session, sessionLoading])

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/organizations')
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }

      const data = await response.json()
      setOrganizations(data.organizations || [])

      // Set active organization based on session
      const activeOrgId = session?.session?.activeOrganizationId
      const activeOrg = data.organizations?.find((org: Organization) => org.id === activeOrgId)
      
      if (activeOrg) {
        setActiveOrganizationState(activeOrg)
      } else if (data.organizations?.length > 0) {
        // Auto-select first organization if none is active
        const firstOrg = data.organizations[0]
        setActiveOrganizationState(firstOrg)
        await setActiveOrganization(firstOrg.id)
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const setActiveOrganization = async (orgId: string) => {
    try {
      const response = await fetch('/api/organizations/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (!response.ok) {
        throw new Error('Failed to set active organization')
      }

      const selectedOrg = organizations.find(org => org.id === orgId)
      if (selectedOrg) {
        setActiveOrganizationState(selectedOrg)
      }

      // Refresh the page to update session context
      window.location.reload()
    } catch (err) {
      console.error('Failed to set active organization:', err)
      setError(err instanceof Error ? err.message : 'Failed to switch organization')
    }
  }

  return {
    organizations,
    activeOrganization,
    isLoading,
    error,
    setActiveOrganization,
  }
}