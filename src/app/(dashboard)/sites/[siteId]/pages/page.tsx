import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import PagesClient from './PagesClient'
import { SiteNav } from '@/components/site/site-nav'

async function fetchPages(siteId: string, params: URLSearchParams) {
  const qs = params.toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sites/${siteId}/gsc/pages?${qs}`, { cache: 'no-store' })
  return res.json()
}

export default async function PagesPage({ params, searchParams }: any) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const siteId = params.siteId
  const data = await fetchPages(siteId, new URLSearchParams({ days: String(searchParams.days || 30), page: String(searchParams.page || 1), pageSize: String(searchParams.pageSize || 50) }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
      </div>
      <SiteNav siteId={siteId} active="pages" />
      {/* @ts-expect-error Server Component boundary */}
      <PagesClient siteId={siteId} initial={data} />
    </div>
  )
}
