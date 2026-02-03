import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { pageSpeedClient } from "@/lib/performance/pagespeed-client"
import { verifyCronSecret } from '@/lib/cron/auth'

export async function POST(request: NextRequest) {
  try {
    const unauthorized = verifyCronSecret(request)
    if (unauthorized) return unauthorized

    console.log('Starting performance tests...')

    // Get all active sites
    const sites = await prisma.site.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        url: true,
      },
    })

    console.log(`Found ${sites.length} sites to test`)

    const results = [] as any[]
    
    for (const site of sites) {
      try {
        console.log(`Testing performance for ${site.domain}`)
        
        // Test both mobile and desktop
        const devices: Array<'mobile' | 'desktop'> = ['mobile', 'desktop']
        
        for (const device of devices) {
          try {
            const startTime = Date.now()
            
            // Create pending test record
            const test = await prisma.performanceTest.create({
              data: {
                siteId: site.id,
                testUrl: site.url,
                device: device.toUpperCase() as 'MOBILE' | 'DESKTOP',
                status: 'RUNNING',
              },
            })
            
            // Run PageSpeed test
            const metrics = await pageSpeedClient.runPerformanceTest(site.url, device)
            const testDuration = Date.now() - startTime
            
            // Update test with results
            await prisma.performanceTest.update({
              where: { id: test.id },
              data: {
                score: metrics.score,
                lcp: metrics.lcp,
                inp: metrics.inp,
                cls: metrics.cls,
                ttfb: metrics.ttfb,
                fcp: metrics.fcp,
                speedIndex: metrics.speedIndex,
                lighthouseVersion: metrics.lighthouseVersion,
                testDuration,
                status: 'COMPLETED',
              },
            })
            
            results.push({
              siteId: site.id,
              domain: site.domain,
              device,
              status: 'success',
              score: metrics.score,
              duration: testDuration,
            })
            
            // Add delay between tests to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 2000))
            
          } catch (deviceError) {
            console.error(`Error testing ${site.domain} on ${device}:`, deviceError)
            
            // Update test record with error
            await prisma.performanceTest.updateMany({
              where: {
                siteId: site.id,
                device: device.toUpperCase() as 'MOBILE' | 'DESKTOP',
                status: 'RUNNING',
              },
              data: {
                status: 'FAILED',
                errorMessage: deviceError instanceof Error ? deviceError.message : 'Unknown error',
              },
            })
            
            results.push({
              siteId: site.id,
              domain: site.domain,
              device,
              status: 'error',
              error: deviceError instanceof Error ? deviceError.message : 'Unknown error',
            })
          }
        }
        
      } catch (siteError) {
        console.error(`Error testing site ${site.domain}:`, siteError)
        results.push({
          siteId: site.id,
          domain: site.domain,
          status: 'error',
          error: siteError instanceof Error ? siteError.message : 'Unknown error',
        })
      }
    }

    console.log('Performance tests completed')
    
    return NextResponse.json({
      success: true,
      message: `Tested ${sites.length} sites`,
      results,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Error in performance test cron:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}