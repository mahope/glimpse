import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { QueueButtons } from '@/components/perf/QueueButtons'
import { PerfChart } from '@/components/perf/PerfChart'
import { PerfTable } from '@/components/perf/PerfTable'
import { SiteNav } from '@/components/site/site-nav'

function StatusPill({ status }: { status: 'pass' | 'warn' | 'fail' | 'na' }) {
  const cls = status === 'pass' ? 'bg-green-100 text-green-800'
    : status === 'warn' ? 'bg-yellow-100 text-yellow-800'
    : status === 'fail' ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-800'
  const label = status === 'pass' ? 'Pass' : status === 'warn' ? 'Needs improvement' : status === 'fail' ? 'Fail' : 'N/A'
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{label}</span>
}

function cwvStatus(metric: 'lcp'|'inp'|'cls', value?: number): 'pass'|'warn'|'fail'|'na' {
  if (value == null) return 'na'
  if (metric === 'lcp') return value <= 2500 ? 'pass' : value <= 4000 ? 'warn' : 'fail'
  if (metric === 'inp') return value <= 200 ? 'pass' : value <= 500 ? 'warn' : 'fail'
  return value <= 0.1 ? 'pass' : value <= 0.25 ? 'warn' : 'fail'
}

async function fetchPerf(siteId: string, strategy?: 'mobile'|'desktop'|null, refresh?: boolean) {
  const qs = new URLSearchParams()
  if (strategy) qs.set('strategy', strategy)
  if (refresh) qs.set('refresh', '1')
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sites/${siteId}/perf?${qs.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ url: string; results: Record<string, any> }>
}

async function hasOpenAlerts(siteId: string) {
  const since = new Date(Date.now() - 24*60*60*1000)
  const count = await prisma.alertEvent.count({ where: { siteId, status: 'OPEN', createdAt: { gte: since } } })
  return count > 0
}

export default async function PerformancePage({ params }: { params: { siteId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth/sign-in')

  const site = await prisma.site.findFirst({
    where: { id: params.siteId, organization: { members: { some: { userId: session.user.id } } }, isActive: true },
    select: { id: true, name: true, url: true },
  })
  if (!site) notFound()

  const data = await fetchPerf(site.id, null, false)
  const showBadge = await hasOpenAlerts(site.id)

  const Card = ({ title, payload }: { title: string; payload?: any }) => (
    <div className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {payload?.reportLink && <a className="text-xs text-blue-600 hover:underline" href={payload.reportLink} target="_blank">Open PSI</a>}
      </div>
      {payload?.error ? (
        <div className="text-sm text-red-600 mt-2">{payload.error}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="text-sm">Score: <span className="font-mono">{payload?.score ?? '—'}</span></div>
          <div className="text-sm flex items-center gap-2">LCP: <span className="font-mono">{payload?.lcp != null ? `${Math.round(payload.lcp)} ms` : '—'}</span> <StatusPill status={cwvStatus('lcp', payload?.lcp)} /></div>
          <div className="text-sm flex items-center gap-2">INP: <span className="font-mono">{payload?.inp != null ? `${Math.round(payload.inp)} ms` : '—'}</span> <StatusPill status={cwvStatus('inp', payload?.inp)} /></div>
          <div className="text-sm flex items-center gap-2">CLS: <span className="font-mono">{payload?.cls != null ? payload.cls.toFixed(2) : '—'}</span> <StatusPill status={cwvStatus('cls', payload?.cls)} /></div>
          <div className="text-sm">FCP: <span className="font-mono">{payload?.fcp != null ? `${Math.round(payload.fcp)} ms` : '—'}</span></div>
          <div className="text-sm">TBT: <span className="font-mono">{payload?.tbt != null ? `${Math.round(payload.tbt)} ms` : '—'}</span></div>
          {payload?.fid != null && <div className="text-sm">FID: <span className="font-mono">{Math.round(payload.fid)} ms</span></div>}
          <div className="text-xs text-gray-500 col-span-2">Updated: {payload?.timestamp ? new Date(payload.timestamp).toLocaleString() : '—'} {payload?.cachedAt ? `(cache ${new Date(payload.cachedAt).toLocaleTimeString()})` : ''}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance - {site.name}</h1>
          <p className="text-gray-600 mt-2">Core Web Vitals and PageSpeed Insights</p>
        </div>
        <div className="flex gap-3 items-center">
          {showBadge && <Link href={`/sites/${site.id}/alerts`} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Alerts</Link>}
          <Button asChild variant="outline"><Link href={`/sites/${site.id}/overview`}>← Back to Overview</Link></Button>
          <Button asChild><Link href={`/sites/${site.id}/performance?refresh=1`}>Refresh PSI</Link></Button>
          <QueueButtons siteId={site.id} />
        </div>
      </div>

      <SiteNav siteId={site.id} active="performance" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Mobile" payload={(data.results as any)?.mobile} />
        <Card title="Desktop" payload={(data.results as any)?.desktop} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-6 mb-2">History</h2>
        <PerfChart siteId={site.id} days={30} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-6 mb-2">Latest per URL</h2>
        {/* Client component renders latest snapshots table */}
        {/* @ts-expect-error Server Component boundary */}
        <PerfTable siteId={site.id} />
      </div>
    </div>
  )
}
