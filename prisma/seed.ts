import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      logo: null,
    },
  })
  console.log('✅ Created demo organization')

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@glimpse.dev' },
    update: {},
    create: {
      email: 'admin@glimpse.dev',
      name: 'Demo Admin',
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  })
  console.log('✅ Created admin user')

  // Create demo customer user
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: {},
    create: {
      email: 'customer@demo.com',
      name: 'Demo Customer',
      role: 'CUSTOMER',
      emailVerified: new Date(),
    },
  })
  console.log('✅ Created customer user')

  // Create organization memberships
  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: adminUser.id,
      role: 'OWNER',
    },
  })

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: customerUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: customerUser.id,
      role: 'MEMBER',
    },
  })
  console.log('✅ Created organization memberships')

  // Create demo sites
  const demoSite1 = await prisma.site.upsert({
    where: {
      organizationId_domain: {
        organizationId: demoOrg.id,
        domain: 'example.com',
      },
    },
    update: {},
    create: {
      name: 'Example Website',
      domain: 'example.com',
      url: 'https://example.com',
      organizationId: demoOrg.id,
      gscPropertyUrl: 'https://example.com/',
      gscConnectedAt: new Date(),
      isActive: true,
    },
  })

  const demoSite2 = await prisma.site.upsert({
    where: {
      organizationId_domain: {
        organizationId: demoOrg.id,
        domain: 'demo-shop.com',
      },
    },
    update: {},
    create: {
      name: 'Demo E-commerce',
      domain: 'demo-shop.com',
      url: 'https://demo-shop.com',
      organizationId: demoOrg.id,
      gscPropertyUrl: null, // Not connected to GSC
      gscConnectedAt: null,
      isActive: true,
    },
  })
  console.log('✅ Created demo sites')

  // Create demo search console data
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const demoQueries = [
    'seo tools',
    'website optimization',
    'search engine ranking',
    'digital marketing',
    'website analytics',
  ]

  const demoPages = [
    '/',
    '/blog',
    '/services',
    '/about',
    '/contact',
  ]

  for (let day = 0; day < 30; day++) {
    const currentDate = new Date(thirtyDaysAgo.getTime() + day * 24 * 60 * 60 * 1000)
    
    for (const query of demoQueries) {
      for (const page of demoPages) {
        const baseClicks = Math.floor(Math.random() * 50) + 10
        const baseImpressions = baseClicks * (Math.floor(Math.random() * 10) + 5)
        const ctr = baseClicks / baseImpressions
        const position = Math.random() * 20 + 5 // Position 5-25
        
        await prisma.searchConsoleData.upsert({
          where: {
            siteId_date_query_page_country_device: {
              siteId: demoSite1.id,
              date: currentDate,
              query: query,
              page: page,
              country: 'usa',
              device: 'MOBILE',
            },
          },
          update: {},
          create: {
            siteId: demoSite1.id,
            date: currentDate,
            query: query,
            page: page,
            country: 'usa',
            device: 'MOBILE',
            clicks: baseClicks,
            impressions: baseImpressions,
            ctr: ctr,
            position: position,
          },
        })
      }
    }
  }
  console.log('✅ Created demo search console data')

  // Create demo performance tests
  for (let i = 0; i < 10; i++) {
    const testDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const device: 'MOBILE' | 'DESKTOP' = i % 2 === 0 ? 'MOBILE' : 'DESKTOP'
    
    await prisma.performanceTest.create({
      data: {
        siteId: demoSite1.id,
        testUrl: demoSite1.url,
        device: device,
        score: Math.floor(Math.random() * 40) + 60, // Score 60-100
        lcp: Math.random() * 2 + 1.5, // LCP 1.5-3.5s
        inp: Math.random() * 200 + 100, // INP 100-300ms
        cls: Math.random() * 0.2 + 0.05, // CLS 0.05-0.25
        ttfb: Math.random() * 500 + 200, // TTFB 200-700ms
        fcp: Math.random() * 2 + 0.8, // FCP 0.8-2.8s
        speedIndex: Math.random() * 3 + 2, // Speed Index 2-5s
        status: 'COMPLETED',
        lighthouseVersion: '12.0.0',
        testDuration: Math.floor(Math.random() * 30000) + 10000,
        createdAt: testDate,
        updatedAt: testDate,
      },
    })
  }
  console.log('✅ Created demo performance tests')

  // Create demo SEO scores
  for (let i = 0; i < 30; i++) {
    const scoreDate = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
    
    const clickTrend = Math.floor(Math.random() * 40) + 60
    const positionTrend = Math.floor(Math.random() * 40) + 60
    const impressionTrend = Math.floor(Math.random() * 40) + 60
    const ctrBenchmark = Math.floor(Math.random() * 40) + 60
    const performanceScore = Math.floor(Math.random() * 40) + 60
    
    const overallScore = Math.floor(
      (clickTrend + positionTrend + impressionTrend + ctrBenchmark + performanceScore) / 5
    )
    
    await prisma.seoScore.upsert({
      where: {
        siteId_date: {
          siteId: demoSite1.id,
          date: scoreDate,
        },
      },
      update: {},
      create: {
        siteId: demoSite1.id,
        date: scoreDate,
        score: overallScore,
        clickTrend: clickTrend,
        positionTrend: positionTrend,
        impressionTrend: impressionTrend,
        ctrBenchmark: ctrBenchmark,
        performanceScore: performanceScore,
        breakdown: {
          components: {
            clickTrend: { score: clickTrend, weight: 0.2 },
            positionTrend: { score: positionTrend, weight: 0.2 },
            impressionTrend: { score: impressionTrend, weight: 0.2 },
            ctrBenchmark: { score: ctrBenchmark, weight: 0.2 },
            performanceScore: { score: performanceScore, weight: 0.2 },
          },
        },
      },
    })
  }
  console.log('✅ Created demo SEO scores')

  console.log('🎉 Database seeded successfully!')
  console.log('')
  console.log('Demo credentials:')
  console.log('  Admin: admin@glimpse.dev')
  console.log('  Customer: customer@demo.com')
  console.log('')
  console.log('Demo sites:')
  console.log('  - example.com (with GSC data)')
  console.log('  - demo-shop.com (without GSC)')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })