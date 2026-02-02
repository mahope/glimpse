import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, MousePointer, Eye, BarChart3, Target } from "lucide-react"

// Mock data - replace with real API calls
const kpiData = {
  clicks: { value: 12540, change: 12.5, trend: 'up' as const },
  impressions: { value: 145200, change: -3.2, trend: 'down' as const },
  ctr: { value: 8.6, change: 15.8, trend: 'up' as const },
  position: { value: 12.3, change: -8.4, trend: 'down' as const }, // Lower position is better
}

interface KpiCardProps {
  title: string
  value: string | number
  change: number
  trend: 'up' | 'down'
  icon: React.ComponentType<{ className?: string }>
  suffix?: string
  description?: string
}

function KpiCard({ title, value, change, trend, icon: Icon, suffix = '', description }: KpiCardProps) {
  const isPositive = (title === 'Average Position' ? trend === 'down' : trend === 'up')

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
            {Math.abs(change)}%
          </span>
          <span className="text-muted-foreground ml-1">vs last month</span>
        </div>
        {description && (
          <CardDescription className="mt-2">{description}</CardDescription>
        )}
      </CardContent>
    </Card>
  )
}

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Clicks"
        value={kpiData.clicks.value}
        change={kpiData.clicks.change}
        trend={kpiData.clicks.trend}
        icon={MousePointer}
        description="Users who clicked through from search results"
      />
      <KpiCard
        title="Total Impressions"
        value={kpiData.impressions.value}
        change={kpiData.impressions.change}
        trend={kpiData.impressions.trend}
        icon={Eye}
        description="Times your pages appeared in search results"
      />
      <KpiCard
        title="Average CTR"
        value={kpiData.ctr.value}
        change={kpiData.ctr.change}
        trend={kpiData.ctr.trend}
        icon={BarChart3}
        suffix="%"
        description="Click-through rate from search results"
      />
      <KpiCard
        title="Average Position"
        value={kpiData.position.value}
        change={kpiData.position.change}
        trend={kpiData.position.trend}
        icon={Target}
        description="Average ranking position in search results"
      />
    </div>
  )
}