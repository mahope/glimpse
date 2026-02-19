'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Noget gik galt</h2>
        <p className="text-gray-500 max-w-md">
          Der opstod en uventet fejl. Prøv at genindlæse siden.
        </p>
      </div>
      <Button onClick={reset}>Prøv igen</Button>
    </div>
  )
}
