import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, MousePointer, Eye, BarChart3, Target } from "lucide-react"

interface KpiData {
  clicks: { value: number; deltaPct: number }
  impressions: { value: number; deltaPct: number }
  ctr: { value: number; deltaPct: number }
  position: { value: number; deltaPct: number }
}

interface KpiCardProps {
  title: string
  value: string | number
  change: number
  icon: React.ComponentType<{ className?: string }>
  suffix?: string
  description?: string
  invertTrend?: boolean
}

function KpiCard({ title, value, change, icon: Icon, suffix = '', description, invertTrend }: KpiCardProps) {
  const isPositive = invertTrend ? change <= 0 : change >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
        <div className={`flex items-center text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? (
            <TrendingUp className="h-4 w-4 mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 mr-1" />
          )}
          <span className="font-medium">
            {Math.abs(Math.round(change * 10) / 10)}%
          </span>
          <span className="text-muted-foreground ml-1">vs last period</span>
        </div>
        {description && (
          <CardDescription className="mt-2">{description}</CardDescription>
        )}
      </CardContent>
    </Card>
  )
}

export function KpiCards({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Clicks"
        value={data.clicks.value}
        change={data.clicks.deltaPct}
        icon={MousePointer}
      />
      <KpiCard
        title="Total Impressions"
        value={data.impressions.value}
        change={data.impressions.deltaPct}
        icon={Eye}
      />
      <KpiCard
        title="Average CTR"
        value={Math.round(data.ctr.value * 10) / 10}
        change={data.ctr.deltaPct}
        icon={BarChart3}
        suffix="%"
      />
      <KpiCard
        title="Average Position"
        value={Math.round(data.position.value * 10) / 10}
        change={data.position.deltaPct}
        icon={Target}
        invertTrend
      />
    </div>
  )
}
