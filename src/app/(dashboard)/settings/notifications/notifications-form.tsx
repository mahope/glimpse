"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'

type Prefs = {
  dailyReport: boolean
  weeklyAlerts: boolean
  crawlSummary: boolean
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}

export function NotificationsForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState<Prefs | null>(null)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setPrefs(d); setOriginal(d) })
      .catch(() => toast('error', 'Kunne ikke hente præferencer'))
  }, [])

  const handleSave = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) throw new Error()
      setOriginal(prefs)
      toast('success', 'Notifikationspræferencer gemt')
    } catch {
      toast('error', 'Kunne ikke gemme præferencer')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = prefs && original && JSON.stringify(prefs) !== JSON.stringify(original)

  if (!prefs) {
    return (
      <div className="space-y-3 max-w-xl">
        <Skeleton className="h-48 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Email-notifikationer</CardTitle>
          <CardDescription>Vælg hvilke emails du vil modtage</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Toggle
            checked={prefs.dailyReport}
            onChange={v => setPrefs(p => p ? { ...p, dailyReport: v } : p)}
            label="Daglig rapport"
            description="Modtag en daglig oversigt over dine sites performance"
          />
          <Toggle
            checked={prefs.weeklyAlerts}
            onChange={v => setPrefs(p => p ? { ...p, weeklyAlerts: v } : p)}
            label="Ugentlige alerts"
            description="Få besked om væsentlige ændringer i performance og positioner"
          />
          <Toggle
            checked={prefs.crawlSummary}
            onChange={v => setPrefs(p => p ? { ...p, crawlSummary: v } : p)}
            label="Crawl-resuméer"
            description="Modtag resultater fra ugentlige site-crawls med fundne problemer"
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !hasChanges}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Gem præferencer
      </Button>
    </div>
  )
}
