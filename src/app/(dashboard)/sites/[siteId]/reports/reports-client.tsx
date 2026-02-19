'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, Trash2, Loader2, Calendar } from 'lucide-react'
import { toast } from '@/components/ui/toast'

interface ReportItem {
  id: string
  type: string
  status: string
  generatedAt: string
  fileName: string
  sentTo: string[]
}

type Schedule = 'NONE' | 'WEEKLY' | 'MONTHLY'

const SCHEDULE_LABELS: Record<Schedule, string> = {
  NONE: 'Ingen',
  WEEKLY: 'Ugentlig',
  MONTHLY: 'Månedlig',
}

export function ReportsClient({
  siteId,
  siteName,
  domain,
  initialSchedule,
}: {
  siteId: string
  siteName: string
  domain: string
  initialSchedule: string
}) {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>(initialSchedule as Schedule)
  const [savingSchedule, setSavingSchedule] = useState(false)

  const fetchReports = useCallback(() => {
    setLoading(true)
    fetch(`/api/sites/${siteId}/reports`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(d => {
        setReports(d.reports)
        if (d.schedule) setSchedule(d.schedule)
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => { fetchReports() }, [fetchReports])

  const generateReport = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/reports`, { method: 'POST' })
      if (!res.ok) throw new Error()
      fetchReports()
    } catch {
      toast('error', 'Kunne ikke generere rapport')
    } finally {
      setGenerating(false)
    }
  }

  const deleteReport = async (reportId: string) => {
    if (!confirm('Slet denne rapport?')) return
    try {
      const res = await fetch(`/api/sites/${siteId}/reports/${reportId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReports(prev => prev.filter(r => r.id !== reportId))
    } catch {
      toast('error', 'Kunne ikke slette rapport')
    }
  }

  const updateSchedule = async (newSchedule: Schedule) => {
    setSavingSchedule(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/reports`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: newSchedule }),
      })
      if (!res.ok) throw new Error()
      setSchedule(newSchedule)
    } catch {
      toast('error', 'Kunne ikke opdatere schedule')
    } finally {
      setSavingSchedule(false)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rapporter — {siteName}</h1>
          <p className="text-sm text-muted-foreground">Generer, download og planlæg rapporter.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/sites/${siteId}/report`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Download seneste
            </Button>
          </a>
          <Button onClick={generateReport} disabled={generating} size="sm">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Generer nu
          </Button>
        </div>
      </div>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Automatisk rapportering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Send rapport automatisk:</span>
            <div className="flex rounded-md border overflow-hidden">
              {(Object.keys(SCHEDULE_LABELS) as Schedule[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => updateSchedule(opt)}
                  disabled={savingSchedule}
                  className={`px-3 py-1.5 text-sm ${schedule === opt ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  {SCHEDULE_LABELS[opt]}
                </button>
              ))}
            </div>
            {schedule !== 'NONE' && (
              <span className="text-xs text-muted-foreground">
                Sendes til organisation-administratorer
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rapporthistorik</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen rapporter endnu. Klik &quot;Generer nu&quot; for at oprette den første.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Dato</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Sendt til</th>
                    <th className="pb-2 font-medium text-right">Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(report => (
                    <tr key={report.id} className="border-b last:border-0">
                      <td className="py-2">
                        {new Date(report.generatedAt).toLocaleDateString('da-DK', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          report.type === 'on-demand' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                          : report.type === 'monthly' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                          : 'bg-gray-50 text-gray-700 dark:bg-gray-950/30 dark:text-gray-400'
                        }`}>
                          {report.type === 'on-demand' ? 'On-demand' : report.type === 'monthly' ? 'Månedlig' : report.type === 'weekly' ? 'Ugentlig' : report.type}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          report.status === 'completed' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        }`}>
                          {report.status === 'completed' ? 'Færdig' : 'Fejlet'}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {report.sentTo.length > 0 ? report.sentTo.join(', ') : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={`/api/sites/${siteId}/reports/${report.id}`} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => deleteReport(report.id)}
                            title="Slet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
