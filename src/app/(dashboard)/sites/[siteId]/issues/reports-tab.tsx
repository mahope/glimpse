"use client"
import useSWR from 'swr'
import Link from 'next/link'

export function ReportsTab({ siteId }: { siteId: string }) {
  const { data, error, isLoading } = useSWR(`/api/sites/${siteId}/crawl/reports`, (u)=>fetch(u).then(r=>r.json()))

  if (isLoading) return <div className="p-4 text-sm text-gray-600">Loading reports…</div>
  if (error) return <div className="p-4 text-sm text-red-600">Failed to load reports</div>

  const reports = data?.reports || []

  if (reports.length === 0) return <div className="p-4 text-sm text-gray-600">No crawl reports yet. Start a crawl to generate one.</div>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Pages</th>
            <th className="py-2 pr-4">Critical</th>
            <th className="py-2 pr-4">Warnings</th>
            <th className="py-2 pr-4">Info</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r: any)=>{
            const totals = r.totals || {}
            const br = r.issueBreakdown || {}
            return (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="py-2 pr-4">{r.pagesCrawled}</td>
                <td className="py-2 pr-4 text-red-600">{totals.errors ?? br.errors?.count ?? 0}</td>
                <td className="py-2 pr-4 text-yellow-600">{totals.warnings ?? br.warnings?.count ?? 0}</td>
                <td className="py-2 pr-4 text-blue-600">{totals.info ?? br.info?.count ?? 0}</td>
                <td className="py-2 pr-4">
                  <Link className="text-blue-600 hover:underline" href={`/sites/${siteId}/reports/${r.id}`}>View</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
