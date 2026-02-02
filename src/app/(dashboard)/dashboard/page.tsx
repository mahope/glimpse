import { KpiCards } from "@/components/dashboard/kpi-cards"
import { ClicksChart } from "@/components/charts/clicks-chart"
import { PositionChart } from "@/components/charts/position-chart"
import { TopKeywords } from "@/components/dashboard/top-keywords"
import { TopPages } from "@/components/dashboard/top-pages"
import { PerformanceOverview } from "@/components/dashboard/performance-overview"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Overview of your SEO performance across all connected sites
        </p>
      </div>

      {/* KPI Cards */}
      <KpiCards />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClicksChart />
        <PositionChart />
      </div>

      {/* Performance Overview */}
      <PerformanceOverview />

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopKeywords />
        <TopPages />
      </div>
    </div>
  )
}