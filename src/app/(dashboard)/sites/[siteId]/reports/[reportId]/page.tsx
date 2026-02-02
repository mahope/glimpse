"use client"
import useSWR from 'swr'
import Link from 'next/link'
import { useMemo } from 'react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  )
}

export default function ReportDetailPage({ params }: { params: { siteId: string; reportId: string } }) {
  const { data, error, isLoading } = useSWR(`/api/sites/${params.siteId}/crawl/reports/${params.reportId}`, (u)=>fetch(u).then(r=>r.json()))

  if (isLoading) return <div className="p-4 text-sm text-gray-600">Loading report…</div>
  if (error) return <div className="p-4 text-sm text-red-600">Failed to load report</div>
  if (data?.error) return <div className="p-4 text-sm text-red-600">{data.error}</div>

  const report = data?.report
  if (!report) return <div className="p-4 text-sm text-gray-600">Report not found</div>

  const totals = report.totals || {}
  const breakdown = report.issueBreakdown || {}
  const topIssues = report.topIssues || []

  const breakdownRows = useMemo(()=>{
    const rows: Array<{ key: string; label: string; count: number; severity?: string }> = []
    const map = breakdown as Record<string, any>
    for (const [key, val] of Object.entries(map)) {
      rows.push({ key, label: key, count: (val as any)?.count ?? 0, severity: (val as any)?.severity })
    }
    return rows.sort((a,b)=> (b.count||0)-(a.count||0))
  }, [breakdown])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Crawl Report</h1>
          <p className="text-gray-600">{new Date(report.startedAt).toLocaleString()} • {report.pagesCrawled} pages</p>
        </div>
        <div className="text-sm">
          <Link className="text-blue-600 hover:underline" href={`/sites/${params.siteId}/issues`}>← Back to Issues</Link>
        </div>
      </div>

      <Section title="Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded border p-3">
            <div className="text-gray-600">Pages crawled</div>
            <div className="text-lg font-semibold">{report.pagesCrawled ?? '-'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-gray-600">Total issues</div>
            <div className="text-lg font-semibold">{totals.total ?? '-'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-gray-600">Errors</div>
            <div className="text-lg font-semibold text-red-600">{totals.errors ?? '-'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-gray-600">Warnings</div>
            <div className="text-lg font-semibold text-yellow-600">{totals.warnings ?? '-'}</div>
          </div>
        </div>
      </Section>

      <Section title="Issue breakdown">
        {breakdownRows.length === 0 ? (
          <div className="text-sm text-gray-600">No issues recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Count</th>
                  <th className="py-2 pr-4">Severity</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map(r=> (
                  <tr key={r.key} className="border-b">
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4">{r.count}</td>
                    <td className="py-2 pr-4 capitalize">{r.severity ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Top issues">
        {!topIssues.length ? (
          <div className="text-sm text-gray-600">No significant issues found.</div>
        ) : (
          <ul className="space-y-3 text-sm">
            {topIssues.map((it: any) => (
              <li key={it.key} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{it.title || it.key}</div>
                  {it.severity && <span className="text-xs px-2 py-1 rounded bg-gray-100 capitalize">{it.severity}</span>}
                </div>
                <div className="text-gray-600">Count: {it.count ?? 0}</div>
                {!!it.examples?.length && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600">Examples ({it.examples.length})</summary>
                    <ul className="mt-2 list-disc pl-5">
                      {it.examples.slice(0,5).map((u: string, idx: number)=> (
                        <li key={idx} className="truncate"><a className="text-blue-600 hover:underline" href={u} target="_blank" rel="noreferrer">{u}</a></li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {report.summary && (
        <Section title="Narrative summary">
          <p className="text-sm whitespace-pre-wrap">{report.summary}</p>
        </Section>
      )}
    </div>
  )
}
