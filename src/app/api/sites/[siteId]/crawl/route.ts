import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CrawlerService } from "@/lib/crawler/crawler-service"
import { rateLimitOrNull } from "@/lib/rate-limit"

export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: Object.fromEntries(request.headers.entries()),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: max 1 crawl per site per hour
    const rl = await rateLimitOrNull(`crawl:${params.siteId}`, { limit: 1, windowSeconds: 3600 })
    if (rl) return rl

    const siteId = params.siteId

    // Verify site exists and user has access
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: session.user.id }
            }
          }
        }
      }
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Check if user is admin or has access to this site's organization
    const isAdmin = session.user.role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0

    if (!isAdmin && !hasOrgAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if a crawl is already running
    const recentCrawl = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        crawlDate: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      orderBy: { crawlDate: 'desc' }
    })

    if (recentCrawl) {
      return NextResponse.json(
        { error: "Crawl already running or completed recently" },
        { status: 429 }
      )
    }

    // Start the crawl (this could be moved to a background job for better UX)
    console.log(`Starting crawl for site ${site.domain}...`)
    
    const crawlResult = await CrawlerService.crawlAndStoreSite(siteId)

    return NextResponse.json({
      success: true,
      message: `Successfully crawled ${site.domain}`,
      data: crawlResult
    })

  } catch (error) {
    console.error("Error starting crawl:", error)
    return NextResponse.json(
      { 
        error: "Failed to start crawl",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: Object.fromEntries(request.headers.entries()),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const siteId = params.siteId

    // Get crawl status/history
    const latestCrawl = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        url: { contains: 'SUMMARY:' }
      },
      orderBy: { crawlDate: 'desc' }
    })

    const crawlHistory = await prisma.crawlResult.groupBy({
      by: ['crawlDate'],
      where: {
        siteId,
        url: { contains: 'SUMMARY:' }
      },
      orderBy: { crawlDate: 'desc' },
      take: 10
    })

    const activeCrawl = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        crawlDate: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      orderBy: { crawlDate: 'desc' }
    })

    return NextResponse.json({
      latestCrawl: latestCrawl ? {
        date: latestCrawl.crawlDate,
        issues: latestCrawl.issues
      } : null,
      crawlHistory: crawlHistory.map(crawl => ({
        date: crawl.crawlDate
      })),
      isRunning: !!activeCrawl
    })

  } catch (error) {
    console.error("Error getting crawl status:", error)
    return NextResponse.json(
      { error: "Failed to get crawl status" },
      { status: 500 }
    )
  }
}