"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, ChevronRight, Globe, Search, Zap, BarChart3, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/toast'

type SiteInfo = {
  id: string
  name: string
  domain: string
  url: string
  gscPropertyUrl: string | null
  gscConnectedAt: string | null
}

const STEPS = [
  { label: 'Velkommen', icon: Globe },
  { label: 'Tilføj site', icon: Search },
  { label: 'Forbind GSC', icon: Search },
  { label: 'Vælg property', icon: BarChart3 },
  { label: 'Færdig!', icon: Zap },
]

function cwvColor(good: boolean, warn: boolean): string {
  if (good) return 'text-[#0cce6b]'
  if (warn) return 'text-[#ffa400]'
  return 'text-[#ff4e42]'
}

export function OnboardingWizard({ sites: initialSites }: { sites: SiteInfo[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [sites, setSites] = useState<SiteInfo[]>(initialSites)
  const [selectedSite, setSelectedSite] = useState<SiteInfo | null>(null)
  const cancelledRef = useRef(false)

  // Site creation form
  const [siteName, setSiteName] = useState('')
  const [siteDomain, setSiteDomain] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [creating, setCreating] = useState(false)

  // GSC
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [properties, setProperties] = useState<string[]>([])
  const [loadingProps, setLoadingProps] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // PSI test
  const [psiLoading, setPsiLoading] = useState(false)
  const [psiResult, setPsiResult] = useState<{ perfScore: number; lcpMs: number; clsValue: number; ttfbMs: number } | null>(null)

  // Cleanup ref on unmount
  useEffect(() => {
    return () => { cancelledRef.current = true }
  }, [])

  // Determine initial step based on existing sites and URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const returningFromOAuth = params.get('connected') === '1'

    if (initialSites.length > 0) {
      const connected = initialSites.find(s => s.gscConnectedAt)
      const unconnected = initialSites.find(s => !s.gscConnectedAt)

      if (connected && !returningFromOAuth) {
        setSelectedSite(connected)
        setStep(4)
      } else if (unconnected) {
        setSelectedSite(unconnected)
        setStep(returningFromOAuth ? 3 : 2)
      }
    }
  }, [initialSites])

  // Fetch GSC auth URL lazily when reaching step 2
  const fetchAuthUrl = useCallback(() => {
    if (authUrl) return
    fetch('/api/gsc/auth-url?returnTo=onboarding')
      .then(r => r.json())
      .then(d => { if (!cancelledRef.current) setAuthUrl(d.url) })
      .catch(() => {})
  }, [authUrl])

  useEffect(() => {
    if (step === 2) fetchAuthUrl()
  }, [step, fetchAuthUrl])

  // Auto-fetch properties when reaching step 3
  const fetchProperties = useCallback(async () => {
    if (!selectedSite) return
    setLoadingProps(true)
    try {
      const res = await fetch(`/api/sites/${selectedSite.id}/gsc/properties`)
      const data = await res.json()
      if (!cancelledRef.current) setProperties(data.properties || [])
    } catch {
      toast('error', 'Kunne ikke hente GSC properties')
    } finally {
      if (!cancelledRef.current) setLoadingProps(false)
    }
  }, [selectedSite])

  useEffect(() => {
    if (step === 3 && properties.length === 0) {
      void fetchProperties()
    }
  }, [step, properties.length, fetchProperties])

  const createSite = async () => {
    if (!siteName.trim() || !siteDomain.trim() || !siteUrl.trim()) {
      toast('error', 'Udfyld alle felter')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: siteName, domain: siteDomain, url: siteUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kunne ikke oprette site')
      }
      const site = await res.json()
      const newSite: SiteInfo = {
        id: site.id,
        name: site.name,
        domain: site.domain,
        url: site.url,
        gscPropertyUrl: null,
        gscConnectedAt: null,
      }
      setSites(prev => [...prev, newSite])
      setSelectedSite(newSite)
      setStep(2)
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Fejl ved oprettelse')
    } finally {
      setCreating(false)
    }
  }

  const startGscAuth = () => {
    if (!authUrl) return
    window.location.href = authUrl
  }

  const selectProperty = async (propertyUrl: string) => {
    if (!selectedSite) return
    setConnecting(true)
    try {
      const res = await fetch(`/api/sites/${selectedSite.id}/gsc/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Forbindelse fejlede')
      }
      setSelectedSite(prev => prev ? { ...prev, gscPropertyUrl: propertyUrl, gscConnectedAt: new Date().toISOString() } : null)
      setStep(4)
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Forbindelse fejlede')
    } finally {
      setConnecting(false)
    }
  }

  const runPsiTest = async () => {
    if (!selectedSite) return
    setPsiLoading(true)
    try {
      const res = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'performance-test', siteId: selectedSite.id, device: 'MOBILE' }),
      })
      if (!res.ok) throw new Error('Kunne ikke starte test')

      let attempts = 0
      const poll = async (): Promise<void> => {
        if (cancelledRef.current) return
        attempts++
        if (attempts > 20) {
          setPsiResult({ perfScore: 0, lcpMs: 0, clsValue: 0, ttfbMs: 0 })
          return
        }
        const snapRes = await fetch(`/api/sites/${selectedSite.id}/perf/latest?strategy=MOBILE&page=1`)
        if (snapRes.ok) {
          const data = await snapRes.json()
          if (data.items?.length > 0) {
            const item = data.items[0]
            if (!cancelledRef.current) {
              setPsiResult({
                perfScore: item.perfScore ?? 0,
                lcpMs: item.lcpMs ?? 0,
                clsValue: item.cls ?? 0,
                ttfbMs: item.ttfbMs ?? 0,
              })
            }
            return
          }
        }
        await new Promise(r => setTimeout(r, 3000))
        return poll()
      }
      await poll()
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'PSI test fejlede')
    } finally {
      if (!cancelledRef.current) setPsiLoading(false)
    }
  }

  const markComplete = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!res.ok) throw new Error()
      return true
    } catch {
      toast('error', 'Kunne ikke gemme onboarding-status. Prøv igen.')
      return false
    }
  }

  const completeOnboarding = async () => {
    const ok = await markComplete()
    if (!ok) return
    if (selectedSite) {
      router.push(`/sites/${selectedSite.id}/overview`)
    } else {
      router.push('/sites')
    }
  }

  const skipToSites = async () => {
    const ok = await markComplete()
    if (!ok) return
    router.push('/sites')
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Stepper */}
      <nav className="mb-8">
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <li key={s.label} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0 ${
                  isDone || isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs hidden sm:inline ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${isDone ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step 0: Welcome */}
      {step === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="text-5xl mb-4">&#128640;</div>
            <CardTitle className="text-2xl">Velkommen til Glimpse</CardTitle>
            <CardDescription className="text-base mt-2">
              Glimpse giver dig et komplet overblik over dine websites SEO-performance.
              Vi samler data fra Google Search Console, kører PageSpeed-tests og
              overvåger dine Core Web Vitals &mdash; alt samlet ét sted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Search className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Search Console</div>
                  <div className="text-muted-foreground">Klik, visninger, positioner og keywords</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Hastighed</div>
                  <div className="text-muted-foreground">Core Web Vitals og PageSpeed scores</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <BarChart3 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">SEO Score</div>
                  <div className="text-muted-foreground">Samlet score baseret på alle metrics</div>
                </div>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button size="lg" onClick={() => setStep(1)}>
                Kom i gang <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Add site */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Tilføj din første website</CardTitle>
            <CardDescription>
              Fortæl os om den website du vil tracke. Du kan tilføje flere senere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sites.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Eller vælg en eksisterende site:</Label>
                <div className="grid gap-2">
                  {sites.filter(s => !s.gscConnectedAt).map(site => (
                    <Button
                      key={site.id}
                      variant="outline"
                      className="justify-start h-auto py-3"
                      onClick={() => { setSelectedSite(site); setStep(2) }}
                    >
                      <Globe className="w-4 h-4 mr-2 shrink-0" />
                      <div className="text-left">
                        <div className="font-medium">{site.name}</div>
                        <div className="text-xs text-muted-foreground">{site.domain}</div>
                      </div>
                    </Button>
                  ))}
                </div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">eller opret ny</span></div>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="site-name">Sitenavn</Label>
                <Input id="site-name" placeholder="Min hjemmeside" value={siteName} onChange={e => setSiteName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="site-domain">Domæne</Label>
                <Input id="site-domain" placeholder="example.com" value={siteDomain} onChange={e => {
                  const val = e.target.value
                  setSiteDomain(val)
                  if (!siteUrl || siteUrl === `https://${siteDomain}`) {
                    setSiteUrl(`https://${val}`)
                  }
                }} />
              </div>
              <div>
                <Label htmlFor="site-url">URL</Label>
                <Input id="site-url" placeholder="https://example.com" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(0)}>Tilbage</Button>
              <Button onClick={createSite} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Opret site <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect GSC */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Forbind Google Search Console</CardTitle>
            <CardDescription>
              Giv Glimpse adgang til din Search Console-data for{' '}
              <span className="font-medium">{selectedSite?.name ?? 'din site'}</span>.
              Vi bruger kun læseadgang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              Du bliver sendt til Google for at godkende adgang. Derefter kommer du tilbage hertil.
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>Tilbage</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Allerede godkendt
                </Button>
                <Button onClick={startGscAuth} disabled={!authUrl}>
                  Forbind Google <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select GSC property */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Vælg GSC Property</CardTitle>
            <CardDescription>
              Vælg den Search Console property der matcher{' '}
              <span className="font-medium">{selectedSite?.domain}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingProps ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : properties.length === 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Ingen properties fundet.</div>
                <Button variant="outline" onClick={fetchProperties}>
                  Prøv igen
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                {properties.map(p => (
                  <Button
                    key={p}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    disabled={connecting}
                    onClick={() => selectProperty(p)}
                  >
                    {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2 shrink-0" />}
                    <span className="truncate">{p}</span>
                  </Button>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>Tilbage</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <Card>
          <CardHeader className="text-center">
            <div className="text-5xl mb-4">&#127881;</div>
            <CardTitle className="text-2xl">Du er klar!</CardTitle>
            <CardDescription className="text-base mt-2">
              {selectedSite?.gscConnectedAt
                ? `${selectedSite.name} er forbundet til Google Search Console. Vi henter nu dine seneste 90 dages data i baggrunden.`
                : 'Din site er oprettet. Du kan forbinde Google Search Console senere fra site-indstillingerne.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Optional PSI test */}
            {selectedSite && !psiResult && (
              <div className="p-4 rounded-lg border bg-muted/30 text-center space-y-3">
                <div className="text-sm text-muted-foreground">
                  Vil du køre en hurtig PageSpeed-test?
                </div>
                <Button variant="outline" onClick={runPsiTest} disabled={psiLoading}>
                  {psiLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {psiLoading ? 'Kører test...' : 'Kør PageSpeed test'}
                </Button>
              </div>
            )}

            {/* PSI result */}
            {psiResult && psiResult.perfScore > 0 && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="text-sm font-medium mb-3 text-center">PageSpeed resultater (mobil)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className={`text-2xl font-bold ${cwvColor(psiResult.perfScore >= 90, psiResult.perfScore >= 50)}`}>
                      {psiResult.perfScore}
                    </div>
                    <div className="text-xs text-muted-foreground">Perf Score</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${cwvColor(psiResult.lcpMs <= 2500, psiResult.lcpMs <= 4000)}`}>
                      {(psiResult.lcpMs / 1000).toFixed(1)}s
                    </div>
                    <div className="text-xs text-muted-foreground">LCP</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${cwvColor(psiResult.clsValue <= 0.1, psiResult.clsValue <= 0.25)}`}>
                      {psiResult.clsValue.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">CLS</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${cwvColor(psiResult.ttfbMs <= 800, psiResult.ttfbMs <= 1800)}`}>
                      {psiResult.ttfbMs}ms
                    </div>
                    <div className="text-xs text-muted-foreground">TTFB</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={skipToSites}>
                Se alle sites
              </Button>
              <Button size="lg" onClick={completeOnboarding}>
                Gå til dashboard <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skip link */}
      {step < 4 && (
        <div className="text-center mt-6">
          <button
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            onClick={skipToSites}
          >
            Spring over og gå direkte til sites
          </button>
        </div>
      )}
    </div>
  )
}
