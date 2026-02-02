import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gauge, Zap, Clock, AlertTriangle } from "lucide-react"

// Mock performance data
const performanceData = {
  overallScore: 78,
  lcp: { value: 2.1, status: 'good', label: 'LCP' },
  inp: { value: 180, status: 'good', label: 'INP' },
  cls: { value: 0.08, status: 'good', label: 'CLS' },
  ttfb: { value: 950, status: 'needs-improvement', label: 'TTFB' },
}

function getStatusColor(status: string) {
  switch (status) {
    case 'good':
      return 'text-emerald-600 bg-emerald-100'
    case 'needs-improvement':
      return 'text-orange-600 bg-orange-100'
    case 'poor':
      return 'text-red-600 bg-red-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'good':
      return <Zap className="h-4 w-4" />
    case 'needs-improvement':
      return <Clock className="h-4 w-4" />
    case 'poor':
      return <AlertTriangle className="h-4 w-4" />
    default:
      return <Gauge className="h-4 w-4" />
  }
}

export function PerformanceOverview() {
  const metrics = [
    performanceData.lcp,
    performanceData.inp,
    performanceData.cls,
    performanceData.ttfb,
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>
            Core Web Vitals and performance metrics from PageSpeed Insights
          </CardDescription>
        </div>
        <Button variant="outline" size="sm">
          Run Test
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Overall Score */}
          <div className="flex flex-col items-center justify-center p-4">
            <div className="relative">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - performanceData.overallScore / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{performanceData.overallScore}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 font-medium">Overall Score</p>
          </div>

          {/* Core Web Vitals */}
          <div className="md:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(metric.status)}`}>
                  {getStatusIcon(metric.status)}
                  <span className="ml-1">{metric.label}</span>
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {metric.label === 'LCP' && `${metric.value}s`}
                  {metric.label === 'INP' && `${metric.value}ms`}
                  {metric.label === 'CLS' && metric.value}
                  {metric.label === 'TTFB' && `${metric.value}ms`}
                </div>
                <div className="text-xs text-gray-500 capitalize">{metric.status.replace('-', ' ')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 bg-orange-50 rounded-lg">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-orange-800">
                Performance Issues Detected
              </h4>
              <p className="text-sm text-orange-700 mt-1">
                TTFB is slower than recommended. Consider optimizing server response time.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}