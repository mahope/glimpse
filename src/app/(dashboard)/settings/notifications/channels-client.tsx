'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { Plus, Trash2, Send, Hash, Globe, Loader2 } from 'lucide-react'

interface Channel {
  id: string
  name: string
  type: 'SLACK' | 'WEBHOOK'
  config: Record<string, unknown>
  events: string[]
  enabled: boolean
}

const EVENT_LABELS: Record<string, string> = {
  alert: 'Alerts',
  report: 'Rapporter',
  uptime: 'Uptime',
}

export function ChannelsClient({ canManage }: { canManage: boolean }) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'SLACK' | 'WEBHOOK'>('SLACK')
  const [formWebhookUrl, setFormWebhookUrl] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formSecret, setFormSecret] = useState('')
  const [formEvents, setFormEvents] = useState<string[]>(['alert', 'uptime'])
  const [saving, setSaving] = useState(false)

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/organizations/notification-channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const resetForm = () => {
    setFormName('')
    setFormType('SLACK')
    setFormWebhookUrl('')
    setFormUrl('')
    setFormSecret('')
    setFormEvents(['alert', 'uptime'])
    setShowForm(false)
  }

  const createChannel = async () => {
    if (!formName.trim()) return
    setSaving(true)

    const config = formType === 'SLACK'
      ? { webhookUrl: formWebhookUrl }
      : { url: formUrl, ...(formSecret ? { secret: formSecret } : {}) }

    try {
      const res = await fetch('/api/organizations/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          config,
          events: formEvents,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast('error', data.error || 'Kunne ikke oprette kanal')
        return
      }
      toast('success', 'Kanal oprettet')
      resetForm()
      fetchChannels()
    } catch {
      toast('error', 'Noget gik galt')
    } finally {
      setSaving(false)
    }
  }

  const deleteChannel = async (id: string) => {
    if (!confirm('Slet denne notifikationskanal?')) return
    try {
      const res = await fetch(`/api/organizations/notification-channels?channelId=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('error', 'Kunne ikke slette kanal')
        return
      }
      fetchChannels()
    } catch {
      toast('error', 'Noget gik galt')
    }
  }

  const toggleEnabled = async (channel: Channel) => {
    try {
      const res = await fetch('/api/organizations/notification-channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id, enabled: !channel.enabled }),
      })
      if (res.ok) fetchChannels()
    } catch { /* ignore */ }
  }

  const testChannel = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch('/api/organizations/notification-channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: id }),
      })
      if (res.ok) {
        toast('success', 'Test-notifikation sendt!')
      } else {
        const data = await res.json()
        toast('error', data.error || 'Test fejlede')
      }
    } catch {
      toast('error', 'Noget gik galt')
    } finally {
      setTesting(null)
    }
  }

  const toggleEvent = (event: string) => {
    setFormEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  if (loading) {
    return <Skeleton className="h-48 rounded-lg" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifikationskanaler</CardTitle>
          <CardDescription>Modtag alerts og rapporter via Slack eller webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Ingen kanaler konfigureret. Tilføj en Slack- eller webhook-integration.
            </p>
          )}

          {channels.length > 0 && (
            <div className="space-y-3 mb-4">
              {channels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {ch.type === 'SLACK' ? <Hash className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {ch.name}
                        {!ch.enabled && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Deaktiveret</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ch.type === 'SLACK' ? 'Slack' : 'Webhook'} · {ch.events.map(e => EVENT_LABELS[e] || e).join(', ')}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => testChannel(ch.id)}
                        disabled={testing === ch.id}
                      >
                        {testing === ch.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleEnabled(ch)}
                      >
                        {ch.enabled ? 'Deaktiver' : 'Aktiver'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => deleteChannel(ch.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj kanal
            </Button>
          )}

          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kanal-navn"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                />
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as 'SLACK' | 'WEBHOOK')}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                >
                  <option value="SLACK">Slack</option>
                  <option value="WEBHOOK">Webhook</option>
                </select>
              </div>

              {formType === 'SLACK' ? (
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formWebhookUrl}
                  onChange={e => setFormWebhookUrl(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                />
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://example.com/webhook"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  />
                  <input
                    type="text"
                    placeholder="HMAC-secret (valgfrit)"
                    value={formSecret}
                    onChange={e => setFormSecret(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  />
                </div>
              )}

              <div>
                <div className="text-xs font-medium mb-1.5">Begivenheder</div>
                <div className="flex gap-2">
                  {Object.entries(EVENT_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleEvent(key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        formEvents.includes(key)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={createChannel} disabled={saving || !formName.trim() || formEvents.length === 0}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Opret
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Annuller
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
