import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const body = UpdateSchema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Invalid data', details: body.error.errors }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: body.data.name },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json(user)
}
