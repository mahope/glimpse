import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSiteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().min(1, "Domain is required"),
  url: z.string().url("Valid URL is required"),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: Object.fromEntries(request.headers.entries()),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const sites = await prisma.site.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        url: true,
        gscConnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ sites })
  } catch (error) {
    console.error("Error fetching sites:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: Object.fromEntries(request.headers.entries()),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No active organization" }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = createSiteSchema.parse(body)

    // Check if site already exists for this organization
    const existingSite = await prisma.site.findUnique({
      where: {
        organizationId_domain: {
          organizationId,
          domain: validatedData.domain,
        },
      },
    })

    if (existingSite) {
      return NextResponse.json(
        { error: "Site already exists for this organization" },
        { status: 409 }
      )
    }

    const site = await prisma.site.create({
      data: {
        name: validatedData.name,
        domain: validatedData.domain,
        url: validatedData.url,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        url: true,
        gscConnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ site }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating site:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}