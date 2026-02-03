'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function QueueButtons({ siteId }: { siteId: string }) {
  const [loadingKind, setLoadingKind] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const call = async (kind: 'performance-test' | 'score-calculation', device?: 'MOBILE' | 'DESKTOP') => {
    try {
      setMessage(null)
      setLoadingKind(device ? `${kind}:${device}` : kind)
      const res = await fetch(`/api/sites/${siteId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, params: device ? { device } : {} }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMessage('Queued! Job ' + (data.jobId || ''))
    } catch (e: any) {
      setMessage(e.message || 'Failed')
    } finally {
      setLoadingKind(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" onClick={() => call('performance-test', 'MOBILE')} disabled={loadingKind !== null}>
        {loadingKind === 'performance-test:MOBILE' ? 'Queuing…' : 'Queue PSI (Mobile)'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => call('performance-test', 'DESKTOP')} disabled={loadingKind !== null}>
        {loadingKind === 'performance-test:DESKTOP' ? 'Queuing…' : 'Queue PSI (Desktop)'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => call('score-calculation')} disabled={loadingKind !== null}>
        {loadingKind === 'score-calculation' ? 'Queuing…' : 'Recalculate SEO score'}
      </Button>
      {message && <span className="text-xs text-gray-600 ml-2">{message}</span>}
    </div>
  )
}
