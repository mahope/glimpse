import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AcceptInviteButton } from './accept-button'

export default async function InvitePage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/auth/sign-in?redirect=/invite/${invitationId}`)

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { organization: { select: { name: true } } },
  })

  if (!invitation || invitation.status !== 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invitation ugyldig</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Denne invitation er enten udløbet, allerede brugt, eller eksisterer ikke.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (new Date() > invitation.expiresAt) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invitation udløbet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Denne invitation er udløbet. Bed din administrator om at sende en ny.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user email matches invitation
  if (session.user.email !== invitation.email) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Forkert bruger</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Denne invitation er sendt til <strong>{invitation.email}</strong>. Du er logget ind som <strong>{session.user.email}</strong>.
              Log ind med den korrekte konto for at acceptere.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Invitation til {invitation.organization.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Du er inviteret til at deltage i <strong>{invitation.organization.name}</strong> som{' '}
            <strong>{invitation.role === 'ADMIN' ? 'Administrator' : 'Medlem'}</strong>.
          </p>
          <AcceptInviteButton invitationId={invitation.id} />
        </CardContent>
      </Card>
    </div>
  )
}
