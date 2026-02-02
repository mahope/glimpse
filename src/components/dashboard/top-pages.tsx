import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react"

// Mock data - replace with real API calls
const mockPages = [
  { 
    page: '/blog/wordpress-security-guide', 
    title: 'WordPress Security Guide',
    clicks: 2140, 
    impressions: 28600, 
    ctr: 7.5, 
    position: 6.2, 
    change: 18.3 
  },
  { 
    page: '/services/web-development', 
    title: 'Web Development Services',
    clicks: 1850, 
    impressions: 24200, 
    ctr: 7.6, 
    position: 8.1, 
    change: -5.2 
  },
  { 
    page: '/blog/seo-checklist-2024', 
    title: 'SEO Checklist 2024',
    clicks: 1420, 
    impressions: 19800, 
    ctr: 7.2, 
    position: 9.8, 
    change: 12.7 
  },
  { 
    page: '/portfolio/ecommerce-projects', 
    title: 'E-commerce Projects',
    clicks: 980, 
    impressions: 14600, 
    ctr: 6.7, 
    position: 12.4, 
    change: -2.1 
  },
  { 
    page: '/blog/wordpress-performance', 
    title: 'WordPress Performance Optimization',
    clicks: 750, 
    impressions: 11200, 
    ctr: 6.7, 
    position: 15.3, 
    change: 8.9 
  },
  { 
    page: '/services/seo-consulting', 
    title: 'SEO Consulting Services',
    clicks: 620, 
    impressions: 9400, 
    ctr: 6.6, 
    position: 18.7, 
    change: 15.4 
  },
]

export function TopPages() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
        <CardDescription>
          Best performing pages from Google Search Console
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockPages.map((page) => (
            <div key={page.page} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-sm truncate">{page.title}</p>
                      <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{page.page}</p>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                      <span>{page.clicks.toLocaleString()} clicks</span>
                      <span>{page.impressions.toLocaleString()} impressions</span>
                      <span>{page.ctr}% CTR</span>
                      <span>Pos. {page.position}</span>
                    </div>
                  </div>
                  <div className="flex items-center ml-4">
                    <div className={`flex items-center text-xs ${page.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {page.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      <span className="font-medium">{Math.abs(page.change)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}