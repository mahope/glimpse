"use client"

import useSWR from 'swr'
import { useState } from 'react'
import { AlertMetric, PerfDevice, AlertRule } from '@prisma/client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const deviceOptions: PerfDevice[] = ['ALL', 'MOBILE', 'DESKTOP']
const metricOptions: AlertMetric[] = ['LCP', 'INP', 'CLS', 'SCORE_DROP']

export function RulesClient({ siteId }: { siteId: string }) {
  const { data, mutate, isLoading } = useSWR<{ items: AlertRule[] }>(`/api/sites/${siteId}/alerts/rules`, fetcher)
  const [form, setForm] = useState<{ metric: AlertMetric; device: PerfDevice; threshold: number; recipients: string }>(
    { metric: 'LCP', device: 'MOBILE', threshold: 2500, recipients: '' }
  )
  const [saving, setSaving] = useState(false)

  const items = data?.items ?? []

  async function createRule() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/alerts/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, recipients: form.recipients.split(',').map(s => s.trim()).filter(Boolean) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create rule')
      mutate({ items: [json.item, ...items] }, { revalidate: false })
      setForm({ metric: 'LCP', device: 'MOBILE', threshold: 2500, recipients: '' })
    } catch (e) {
      console.error(e)
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function updateRule(id: string, patch: Partial<AlertRule>) {
    const prev = items
    const next = items.map(it => it.id === id ? { ...it, ...patch } : it)
    mutate({ items: next }, { revalidate: false })
    try {
      const res = await fetch(`/api/sites/${siteId}/alerts/rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update rule')
      mutate({ items: items.map(it => it.id === id ? json.item : it) }, { revalidate: false })
    } catch (e) {
      console.error(e)
      alert((e as Error).message)
      mutate({ items: prev }, { revalidate: false })
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    const prev = items
    mutate({ items: items.filter(it => it.id !== id) }, { revalidate: false })
    try {
      const res = await fetch(`/api/sites/${siteId}/alerts/rules?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete rule')
    } catch (e) {
      console.error(e)
      alert((e as Error).message)
      mutate({ items: prev }, { revalidate: false })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded border p-4 space-y-3">
        <div className="font-medium">Create rule</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <label className="text-sm">Metric
            <select className="input" value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as AlertMetric }))}>
              {metricOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-sm">Device
            <select className="input" value={form.device} onChange={e => setForm(f => ({ ...f, device: e.target.value as PerfDevice }))}>
              {deviceOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-sm">Threshold
            <input className="input" type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: parseFloat(e.target.value) }))} />
          </label>
          <label className="text-sm col-span-2">Recipients (comma separated)
            <input className="input w-full" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} />
          </label>
          <button className="btn" onClick={createRule} disabled={saving}>Add</button>
        </div>
      </div>

      <div className="rounded border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-gray-50">
              <th className="py-2 px-3">Enabled</th>
              <th className="py-2 px-3">Metric</th>
              <th className="py-2 px-3">Device</th>
              <th className="py-2 px-3">Threshold</th>
              <th className="py-2 px-3">Recipients</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-b">
                <td className="py-2 px-3">
                  <input type="checkbox" checked={r.enabled} onChange={e => updateRule(r.id, { enabled: e.target.checked })} />
                </td>
                <td className="py-2 px-3">{r.metric}</td>
                <td className="py-2 px-3">{r.device}</td>
                <td className="py-2 px-3">
                  <input className="input w-28" type="number" value={r.threshold} onChange={e => updateRule(r.id, { threshold: parseFloat(e.target.value) })} />
                </td>
                <td className="py-2 px-3">
                  <input className="input w-full" value={r.recipients.join(', ')} onChange={e => updateRule(r.id, { recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) as any })} />
                </td>
                <td className="py-2 px-3 text-right">
                  <button className="btn-danger" onClick={() => deleteRule(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!items.length && !isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No rules yet. Suggested defaults: LCP Mobile 2500, LCP Desktop 2000, INP 200, CLS 0.1, Performance score drop 10 (ALL).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
