import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyCronSecret } from '@/lib/cron/auth'

export async function POST(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request)
    if (unauthorized) return unauthorized

    console.log('Starting GSC data sync...')

    // Get all active sites with GSC connection
    const sites = await prisma.site.findMany({
      where: {
        isActive: true,
        gscRefreshToken: { not: null },
      },
      include: {
        organization: true,
      },
    })

    console.log(`Found ${sites.length} sites to sync`)

    const results: any[] = []
    
    for (const site of sites) {
      try {
        console.log(`Syncing GSC data for ${site.domain}`)
        // TODO: integrate with real sync service
        results.push({
          siteId: site.id,
          domain: site.domain,
          status: 'queued'
        })
        
      } catch (siteError) {
        console.error(`Error syncing site ${site.domain}:`, siteError)
        results.push({
          siteId: site.id,
          domain: site.domain,
          status: 'error',
          error: siteError instanceof Error ? siteError.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${sites.length} sites`,
      results,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Error in GSC sync cron:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}