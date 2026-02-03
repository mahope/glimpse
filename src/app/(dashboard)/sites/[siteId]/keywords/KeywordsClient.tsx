"use client"
import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeywordTable, type KeywordRow } from '@/components/gsc/KeywordTable'

export default function KeywordsClient({ siteId, initial }: { siteId: string; initial: { items: KeywordRow[]; page: number; pageSize: number } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<KeywordRow[]>(initial.items || [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(Number(searchParams.get('page') || initial.page || 1))
  const [pageSize, setPageSize] = React.useState(Number(searchParams.get('pageSize') || initial.pageSize || 50))
  const [days, setDays] = React.useState(Number(searchParams.get('days') || 30))
  const [device, setDevice] = React.useState<string>(searchParams.get('device') || 'all')
  const [country, setCountry] = React.useState<string>(searchParams.get('country') || 'ALL')
  const [sort, setSort] = React.useState<string>(searchParams.get('sort') || 'clicks')

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ days: String(days), page: String(page), pageSize: String(pageSize), device, country, sort })
      const res = await fetch(`/api/sites/${siteId}/gsc/keywords?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setItems(json.items || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [siteId, days, page, pageSize, device, country, sort])

  React.useEffect(() => { fetchData() }, [fetchData])

  // keep URL in sync
  React.useEffect(() => {
    const sp = new URLSearchParams()
    sp.set('days', String(days))
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    sp.set('device', device)
    sp.set('country', country)
    sp.set('sort', sort)
    router.replace(`?${sp.toString()}`)
  }, [days, page, pageSize, device, country, sort])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select className="border rounded px-2 py-1" value={days} onChange={e=>setDays(Number(e.target.value))}>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
        <select className="border rounded px-2 py-1" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <select className="border rounded px-2 py-1" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="clicks">Clicks</option>
          <option value="impressions">Impressions</option>
          <option value="ctr">CTR</option>
          <option value="position">Position</option>
        </select>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && items.length === 0 && <div className="text-sm text-gray-500">No data</div>}

      <KeywordTable items={items} onFilter={({ device, country }) => { setDevice(device); setCountry(country.toUpperCase()) }} />

      <div className="flex items-center gap-2">
        <button className="border rounded px-2 py-1" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>
        <span className="text-sm">Page {page}</span>
        <button className="border rounded px-2 py-1" onClick={()=>setPage(p=>p+1)}>Next</button>
      </div>
    </div>
  )
}
