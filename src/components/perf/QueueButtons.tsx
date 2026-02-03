'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

export function QueueButtons({ siteId }: { siteId: string }) {
  const [loadingKind, setLoadingKind] = useState<string | null>(null)

  const call = async (kind: 'performance-test' | 'score-calculation', device?: 'MOBILE' | 'DESKTOP') => {
    try {
      setLoadingKind(device ? `${kind}:${device}` : kind)
      const res = await fetch(`/api/sites/${siteId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, params: device ? { device } : {} }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      toast('success', 'Queued ' + kind + (data.jobId ? ` (#${data.jobId})` : ''))
    } catch (e: any) {
      toast('error', e.message || 'Failed to queue')
    } finally {
      setLoadingKind(null)
    }
  }

  const disabled = loadingKind !== null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" onClick={() => call('performance-test', 'MOBILE')} disabled={disabled}>
        {loadingKind === 'performance-test:MOBILE' ? 'Queuing…' : 'Queue PSI (Mobile)'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => call('performance-test', 'DESKTOP')} disabled={disabled}>
        {loadingKind === 'performance-test:DESKTOP' ? 'Queuing…' : 'Queue PSI (Desktop)'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => call('score-calculation')} disabled={disabled}>
        {loadingKind === 'score-calculation' ? 'Queuing…' : 'Recalculate SEO score'}
      </Button>
    </div>
  )
}
