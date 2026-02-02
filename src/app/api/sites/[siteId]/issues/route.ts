import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CrawlIssue } from "@/lib/crawler/types"

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
    const { searchParams } = new URL(request.url)
    
    // Query parameters for filtering
    const category = searchParams.get('category')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify site access
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

    const isAdmin = session.user.role === 'ADMIN'
    const hasOrgAccess = site.organization.members.length > 0

    if (!isAdmin && !hasOrgAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get latest crawl results
    const crawlResults = await prisma.crawlResult.findMany({
      where: {
        siteId,
        url: { not: { contains: 'SUMMARY:' } }
      },
      orderBy: { crawlDate: 'desc' },
      take: limit,
      skip: offset
    })

    // Extract and categorize issues
    const allIssues: CrawlIssue[] = []
    const issuesByUrl: Record<string, CrawlIssue[]> = {}

    for (const result of crawlResults) {
      if (result.issues) {
        const issues = Array.isArray(result.issues) ? result.issues : []
        
        for (const issue of issues) {
          const crawlIssue: CrawlIssue = {
            type: issue.type || 'info',
            category: issue.category || 'technical',
            message: issue.message || 'Unknown issue',
            element: issue.element,
            recommendation: issue.recommendation,
            url: result.url
          }

          // Apply filters
          if (category && crawlIssue.category !== category) continue
          if (severity && crawlIssue.type !== severity) continue

          allIssues.push(crawlIssue)

          if (!issuesByUrl[result.url]) {
            issuesByUrl[result.url] = []
          }
          issuesByUrl[result.url].push(crawlIssue)
        }
      }
    }

    // Group issues by category and severity
    const issueStats = {
      total: allIssues.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {
        error: allIssues.filter(i => i.type === 'error').length,
        warning: allIssues.filter(i => i.type === 'warning').length,
        info: allIssues.filter(i => i.type === 'info').length
      }
    }

    // Count by category
    const categories = ['title', 'description', 'headings', 'images', 'content', 'performance', 'technical', 'links']
    for (const cat of categories) {
      issueStats.byCategory[cat] = allIssues.filter(i => i.category === cat).length
    }

    // Get most common issues
    const issueFrequency: Record<string, number> = {}
    allIssues.forEach(issue => {
      const key = `${issue.category}:${issue.message}`
      issueFrequency[key] = (issueFrequency[key] || 0) + 1
    })

    const topIssues = Object.entries(issueFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => {
        const [category, message] = key.split(':')
        const example = allIssues.find(i => i.category === category && i.message === message)
        return {
          category,
          message,
          count,
          type: example?.type || 'warning',
          recommendation: example?.recommendation
        }
      })

    // Get recent trends
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentCrawl = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        url: { contains: 'SUMMARY:' },
        crawlDate: { gte: oneWeekAgo }
      },
      orderBy: { crawlDate: 'desc' }
    })

    const previousCrawl = await prisma.crawlResult.findFirst({
      where: {
        siteId,
        url: { contains: 'SUMMARY:' },
        crawlDate: { lt: oneWeekAgo }
      },
      orderBy: { crawlDate: 'desc' }
    })

    let trend = null
    if (recentCrawl && previousCrawl && recentCrawl.issues && previousCrawl.issues) {
      const recentIssues = (recentCrawl.issues as any).issueCounts || {}
      const previousIssues = (previousCrawl.issues as any).issueCounts || {}
      
      trend = {
        current: (recentIssues.errors?.count || 0) + (recentIssues.warnings?.count || 0),
        previous: (previousIssues.errors?.count || 0) + (previousIssues.warnings?.count || 0),
        change: 0
      }
      trend.change = trend.current - trend.previous
    }

    return NextResponse.json({
      issues: allIssues,
      issuesByUrl,
      stats: issueStats,
      topIssues,
      trend,
      pagination: {
        limit,
        offset,
        hasMore: crawlResults.length === limit
      }
    })

  } catch (error) {
    console.error("Error fetching issues:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch issues",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}