'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { Loader2, Palette } from 'lucide-react'

interface BrandingData {
  brandColor: string | null
  reportHeaderText: string | null
  reportFooterText: string | null
  hideGlimpseBrand: boolean
  logo: string | null
}

export function BrandingForm({ canEdit = true }: { canEdit?: boolean }) {
  const [data, setData] = useState<BrandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const [brandColor, setBrandColor] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [hideGlimpse, setHideGlimpse] = useState(false)

  useEffect(() => {
    fetch('/api/organizations/branding')
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((d: BrandingData) => {
        setData(d)
        setBrandColor(d.brandColor || '')
        setHeaderText(d.reportHeaderText || '')
        setFooterText(d.reportFooterText || '')
        setHideGlimpse(d.hideGlimpseBrand)
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      toast('error', 'Ugyldig farvekode — brug hex format f.eks. #3B82F6')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/organizations/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandColor: brandColor || null,
          reportHeaderText: headerText || null,
          reportFooterText: footerText || null,
          hideGlimpseBrand: hideGlimpse,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Fejl')
      }
      toast('success', 'Branding opdateret')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Kunne ikke gemme')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-xl">
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Rapport-branding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Kunne ikke hente branding-indstillinger.</p>
            <Button variant="outline" onClick={() => { setFetchError(false); setLoading(true); location.reload() }}>
              Prøv igen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasChanges = data && (
    (brandColor || null) !== (data.brandColor || null) ||
    (headerText || null) !== (data.reportHeaderText || null) ||
    (footerText || null) !== (data.reportFooterText || null) ||
    hideGlimpse !== data.hideGlimpseBrand
  )

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Rapport-branding
          </CardTitle>
          <CardDescription>
            Tilpas udseendet af genererede PDF-rapporter med jeres eget brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Kun organisationsadministratorer kan ændre branding-indstillinger.
            </p>
          )}
          <div>
            <Label htmlFor="brandColor">Brand-farve (hex)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="brandColor"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                placeholder="#3B82F6"
                className="max-w-[200px]"
                disabled={!canEdit}
              />
              {brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor) && (
                <div
                  className="h-9 w-9 rounded border"
                  style={{ backgroundColor: brandColor }}
                />
              )}
              <input
                type="color"
                value={brandColor || '#111827'}
                onChange={e => setBrandColor(e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border p-0"
                disabled={!canEdit}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bruges til overskrifter og accenter i PDF-rapporter.
            </p>
          </div>

          <div>
            <Label htmlFor="headerText">Header-tekst</Label>
            <Input
              id="headerText"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              placeholder="F.eks. 'Månedsrapport fra Firma ApS'"
              maxLength={200}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vises øverst i rapporten. Maks 200 tegn.
            </p>
          </div>

          <div>
            <Label htmlFor="footerText">Footer-tekst</Label>
            <Input
              id="footerText"
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              placeholder="F.eks. 'Fortroligt — kun til intern brug'"
              maxLength={200}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vises nederst i rapporten. Maks 200 tegn.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hideGlimpse"
              checked={hideGlimpse}
              onChange={e => setHideGlimpse(e.target.checked)}
              className="rounded border-input h-4 w-4 accent-primary"
              disabled={!canEdit}
            />
            <Label htmlFor="hideGlimpse" className="cursor-pointer">
              Skjul &quot;Genereret af Glimpse&quot;-tekst
            </Label>
          </div>

          <Button onClick={handleSave} disabled={saving || !hasChanges || !canEdit}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gem ændringer
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
