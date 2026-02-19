'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UserPlus, Trash2, Mail, Shield, User, Crown } from 'lucide-react'

interface MemberItem {
  id: string
  userId: string
  role: string
  name: string | null
  email: string
  image: string | null
  joinedAt: string
}

interface InvitationItem {
  id: string
  email: string
  role: string
  invitedBy: string
  expiresAt: string
  createdAt: string
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown }> = {
  OWNER: { label: 'Ejer', icon: Crown },
  ADMIN: { label: 'Administrator', icon: Shield },
  MEMBER: { label: 'Medlem', icon: User },
}

export function TeamClient({
  organizationId,
  orgName,
  currentUserRole,
  currentUserId,
}: {
  organizationId: string
  orgName: string
  currentUserRole: string
  currentUserId: string
}) {
  const [members, setMembers] = useState<MemberItem[]>([])
  const [invitations, setInvitations] = useState<InvitationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [inviting, setInviting] = useState(false)

  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch('/api/organizations/members'),
        fetch('/api/organizations/invitations'),
      ])
      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(data.members)
      }
      if (invitationsRes.ok) {
        const data = await invitationsRes.json()
        setInvitations(data.invitations)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/organizations/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Kunne ikke sende invitation')
        return
      }
      setInviteEmail('')
      fetchData()
    } catch {
      alert('Noget gik galt')
    } finally {
      setInviting(false)
    }
  }

  const changeRole = async (memberId: string, role: 'ADMIN' | 'MEMBER') => {
    try {
      const res = await fetch('/api/organizations/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Kunne ikke ændre rolle')
        return
      }
      fetchData()
    } catch {
      alert('Noget gik galt')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Fjern dette medlem fra organisationen?')) return
    try {
      const res = await fetch(`/api/organizations/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Kunne ikke fjerne medlem')
        return
      }
      fetchData()
    } catch {
      alert('Noget gik galt')
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/organizations/invitations?invitationId=${invitationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Kunne ikke annullere invitation')
        return
      }
      fetchData()
    } catch {
      alert('Noget gik galt')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{orgName}</h2>
        <p className="text-sm text-muted-foreground">Administrer teammedlemmer og invitationer</p>
      </div>

      {/* Invite form */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Inviter nyt medlem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Email-adresse"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                onKeyDown={e => e.key === 'Enter' && invite()}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                className="rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="MEMBER">Medlem</option>
                <option value="ADMIN">Administrator</option>
              </select>
              <Button onClick={invite} disabled={inviting || !inviteEmail.trim()} size="sm">
                <Mail className="h-4 w-4 mr-1" />
                Send invitation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medlemmer ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map(member => {
              const roleConfig = ROLE_LABELS[member.role] || ROLE_LABELS.MEMBER
              const Icon = roleConfig.icon
              const isCurrentUser = member.userId === currentUserId
              const isOwner = member.role === 'OWNER'

              return (
                <div key={member.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {member.name || member.email}
                        {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(dig)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && !isOwner && !isCurrentUser ? (
                      <>
                        <select
                          value={member.role}
                          onChange={e => changeRole(member.id, e.target.value as 'ADMIN' | 'MEMBER')}
                          className="rounded-md border px-2 py-1 text-xs bg-background"
                        >
                          <option value="ADMIN">Administrator</option>
                          <option value="MEMBER">Medlem</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => removeMember(member.id)}
                          title="Fjern"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isOwner ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        : member.role === 'ADMIN' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                        : 'bg-gray-50 text-gray-700 dark:bg-gray-950/30 dark:text-gray-400'
                      }`}>
                        {roleConfig.label}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventende invitationer ({invitations.length})</CardTitle>
            <CardDescription>Invitationer der endnu ikke er accepteret</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.role === 'ADMIN' ? 'Administrator' : 'Medlem'} · Inviteret af {inv.invitedBy} · Udløber {new Date(inv.expiresAt).toLocaleDateString('da-DK')}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-700"
                      onClick={() => cancelInvitation(inv.id)}
                    >
                      Annuller
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
