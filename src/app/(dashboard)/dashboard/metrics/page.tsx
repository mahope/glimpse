import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { MetricsDashboard } from '@/components/dashboard/metrics-dashboard'

export default async function MetricsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">
            Only administrators can access the metrics dashboard.
          </p>
        </div>
      </div>
    )
  }

  return <MetricsDashboard />
}
