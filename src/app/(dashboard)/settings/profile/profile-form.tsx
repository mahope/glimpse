"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'

type Props = {
  user: { name: string; email: string }
  organization: { name: string; role: string } | null
}

export function ProfileForm({ user, organization }: Props) {
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast('error', 'Navn er påkrævet')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error('Kunne ikke gemme')
      toast('success', 'Profil opdateret')
    } catch {
      toast('error', 'Kunne ikke gemme profil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Dine personlige oplysninger</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Navn</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Email kan ikke ændres</p>
          </div>
          <Button onClick={handleSave} disabled={saving || name.trim() === user.name}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Gem ændringer
          </Button>
        </CardContent>
      </Card>

      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>Din aktive organisation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{organization.name}</span>
              <Badge variant="secondary">{organization.role}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
