import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { JobMonitor } from '@/components/dashboard/job-monitor'

export default async function JobsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/auth/sign-in')
  }

  // Only allow admin users to access job monitoring
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
          <p className="text-gray-600">
            Only administrators can access the job monitoring dashboard.
          </p>
        </div>
      </div>
    )
  }

  return <JobMonitor />
}