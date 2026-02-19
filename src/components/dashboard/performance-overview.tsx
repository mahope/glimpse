import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, Zap, Clock, AlertTriangle } from "lucide-react"

interface PerformanceData {
  overallScore: number | null
  lcp: number | null
  inp: number | null
  cls: number | null
  siteCount: number
}

function cwvStatus(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  if (metric === 'lcp') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
  if (metric === 'inp') return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
  if (metric === 'cls') return value <= 10 ? 'good' : value <= 25 ? 'needs-improvement' : 'poor'
  return 'good'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'good': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'
    case 'needs-improvement': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
    case 'poor': return 'text-red-600 bg-red-100 dark:bg-red-900/30'
    default: return 'text-muted-foreground bg-muted'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'good': return <Zap className="h-4 w-4" />
    case 'needs-improvement': return <Clock className="h-4 w-4" />
    case 'poor': return <AlertTriangle className="h-4 w-4" />
    default: return <Gauge className="h-4 w-4" />
  }
}

export function PerformanceOverview({ data }: { data: PerformanceData | null }) {
  if (!data || data.overallScore == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>Core Web Vitals from PageSpeed Insights</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No performance data available yet. Run a performance test to see results.</p>
        </CardContent>
      </Card>
    )
  }

  const metrics = [
    { label: 'LCP', value: data.lcp, format: (v: number) => `${(v / 1000).toFixed(1)}s`, key: 'lcp' },
    { label: 'INP', value: data.inp, format: (v: number) => `${v}ms`, key: 'inp' },
    { label: 'CLS', value: data.cls, format: (v: number) => `${(v / 100).toFixed(2)}`, key: 'cls' },
  ].filter(m => m.value != null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
        <CardDescription>
          Average Core Web Vitals across {data.siteCount} site{data.siteCount !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="relative">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="40"
                  stroke="#3b82f6" strokeWidth="8" fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - data.overallScore / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{data.overallScore}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Overall Score</p>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric) => {
              const status = cwvStatus(metric.key, metric.value!)
              return (
                <div key={metric.label} className="text-center">
                  <div className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    <span className="ml-1">{metric.label}</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold">{metric.format(metric.value!)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{status.replace('-', ' ')}</div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
