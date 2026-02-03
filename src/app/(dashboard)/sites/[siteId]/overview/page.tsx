import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

async function fetchOverview(siteId: string, params: URLSearchParams) {
  const qs = params.toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sites/${siteId}/overview?${qs}`, { cache: 'no-store' })
  return res.json()
}

function Kpi({ title, value, delta, suffix = '' }: { title: string; value: number; delta: number; suffix?: string }) {
  const positive = title === 'Average Position' ? delta < 0 : delta > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{title === 'Average CTR' ? value.toFixed(2) : value.toLocaleString()}{suffix}</div>
        <div className={`text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>{positive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs prev</div>
      </CardContent>
    </Card>
  )
}

export default async function OverviewPage({ params, searchParams }: any) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const siteId = params.siteId
  const days = String(searchParams.days || 30)
  const device = String(searchParams.device || 'all')
  const country = String((searchParams.country || 'ALL')).toUpperCase()

  const data = await fetchOverview(siteId, new URLSearchParams({ days, device, country }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="space-x-2 text-sm text-muted-foreground">
          <a href={`?days=30`} className={days==='30'? 'font-semibold' : ''}>30d</a>
          <a href={`?days=90`} className={days==='90'? 'font-semibold' : ''}>90d</a>
          <a href={`?days=365`} className={days==='365'? 'font-semibold' : ''}>365d</a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Total Clicks" value={data.kpis.clicks.value} delta={data.kpis.clicks.deltaPct} />
        <Kpi title="Total Impressions" value={data.kpis.impressions.value} delta={data.kpis.impressions.deltaPct} />
        <Kpi title="Average CTR" value={data.kpis.ctr.value} delta={data.kpis.ctr.deltaPct} suffix="%" />
        <Kpi title="Average Position" value={data.kpis.position.value} delta={data.kpis.position.deltaPct} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Clicks" />
                <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} name="Impressions" />
                <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#f59e0b" dot={false} name="CTR %" />
                <Line yAxisId="right" type="monotone" dataKey="position" stroke="#ef4444" dot={false} name="Avg Position" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
