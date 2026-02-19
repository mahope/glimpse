'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, ArrowRight } from 'lucide-react'

interface KeywordOpportunity {
  keyword: string
  position: number
  impressions: number
  potentialExtraClicks: number
}

export function OpportunitiesWidget({ siteId }: { siteId: string }) {
  const [opps, setOpps] = useState<KeywordOpportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sites/${siteId}/recommendations/opportunities?days=30`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(d => setOpps((d.opportunities ?? []).slice(0, 5)))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false))
  }, [siteId])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Lavthængende frugt</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 rounded" /></CardContent>
      </Card>
    )
  }

  if (opps.length === 0) return null

  const totalPotential = opps.reduce((s, o) => s + o.potentialExtraClicks, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            Lavthængende frugt
          </CardTitle>
          <Link href={`/sites/${siteId}/recommendations`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Se alle <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Op til <span className="font-semibold text-emerald-600">+{totalPotential.toLocaleString('da-DK')}</span> potentielle ekstra klik/måned
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {opps.map(opp => (
            <div key={opp.keyword} className="flex items-center justify-between text-sm">
              <span className="truncate flex-1 mr-3" title={opp.keyword}>{opp.keyword}</span>
              <span className="text-xs text-muted-foreground mr-3">pos. {opp.position}</span>
              <span className="text-xs font-semibold text-emerald-600">+{opp.potentialExtraClicks}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
