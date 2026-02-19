import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import KeywordsClient from './KeywordsClient'
import { SiteNav } from '@/components/site/site-nav'

async function fetchKeywords(siteId: string, params: URLSearchParams) {
  const qs = params.toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sites/${siteId}/gsc/keywords?${qs}`, { cache: 'no-store' })
  return res.json()
}

export default async function KeywordsPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const { siteId } = await params
  const sp = await searchParams
  const data = await fetchKeywords(siteId, new URLSearchParams({ days: String(sp.days || 30), page: String(sp.page || 1), pageSize: String(sp.pageSize || 50) }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Keywords</h1>
      </div>
      <SiteNav siteId={siteId} active="keywords" />
      <KeywordsClient siteId={siteId} initial={data} />
    </div>
  )
}
