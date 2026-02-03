import { google } from 'googleapis'
import { prisma } from '@/lib/db'

export type GSCDailyOptions = {
  siteId: string
  propertyUrl: string
  refreshToken?: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  mock?: boolean
}

function getOAuthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`
  )
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export async function fetchAndStoreGSCDaily(opts: GSCDailyOptions) {
  const { siteId, propertyUrl, refreshToken, startDate, endDate, mock } = opts

  if (mock || !refreshToken || !process.env.GOOGLE_CLIENT_ID) {
    // Seed a few mock rows so UI works
    const dates: string[] = []
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    for (const d of dates) {
      await prisma.searchStatDaily.upsert({
        where: { siteId_date_pageUrl_query_device_country: { siteId, date: new Date(d), pageUrl: 'https://example.com/', query: 'example', device: 'desktop', country: 'DK' } },
        update: { clicks: { increment: 2 }, impressions: { increment: 20 }, ctr: 10, position: 12 },
        create: { siteId, date: new Date(d), pageUrl: 'https://example.com/', query: 'example', device: 'desktop', country: 'DK', clicks: 2, impressions: 20, ctr: 10, position: 12 }
      })
    }
    return { mocked: true, records: dates.length }
  }

  const auth = getOAuthClient(refreshToken)
  const webmasters = google.webmasters({ version: 'v3', auth })

  let total = 0
  // Iterate each day to guarantee daily rows
  for (let dt = new Date(startDate); dt <= new Date(endDate); dt.setDate(dt.getDate() + 1)) {
    const day = new Date(dt).toISOString().split('T')[0]
    const response = await webmasters.searchanalytics.query({
      siteUrl: propertyUrl,
      requestBody: {
        startDate: day,
        endDate: day,
        dimensions: ['page', 'query', 'device', 'country'],
        rowLimit: 25000,
        aggregationType: 'auto'
      }
    })
    const rows = response.data.rows || []
    total += rows.length

    for (const row of rows) {
      const [pageUrl, query, device, country] = (row.keys || ['','', 'all','all'])
      await prisma.searchStatDaily.upsert({
        where: { siteId_date_pageUrl_query_device_country: { siteId, date: new Date(day), pageUrl, query, device: String(device || 'all'), country: String(country || 'all') } },
        update: { clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: (row.ctr || 0) * 100, position: row.position || 0 },
        create: {
          siteId,
          date: new Date(day),
          pageUrl,
          query,
          device: String(device || 'all'),
          country: String(country || 'all'),
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: (row.ctr || 0) * 100,
          position: row.position || 0
        }
      })
    }
  }

  await prisma.site.update({ where: { id: siteId }, data: { gscLastSyncedAt: new Date() } })
  return { mocked: false, records: total }
}
