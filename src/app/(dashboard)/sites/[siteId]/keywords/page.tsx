import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import KeywordsClient from './KeywordsClient'

async function fetchKeywords(siteId: string, params: URLSearchParams) {
  const qs = params.toString()
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sites/${siteId}/gsc/keywords?${qs}`, { cache: 'no-store' })
  return res.json()
}

export default async function KeywordsPage({ params, searchParams }: any) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const siteId = params.siteId
  const data = await fetchKeywords(siteId, new URLSearchParams({ days: String(searchParams.days || 30), page: String(searchParams.page || 1), pageSize: String(searchParams.pageSize || 50) }))

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Keywords</h1>
      {/* @ts-expect-error Server Component boundary */}
      <KeywordsClient siteId={siteId} initial={data} />
    </div>
  )
}
