import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

// Mock data - replace with real API calls
const mockKeywords = [
  { query: 'wordpress development', clicks: 1240, impressions: 15600, ctr: 7.9, position: 8.2, change: 12.5 },
  { query: 'seo optimization', clicks: 980, impressions: 12800, ctr: 7.7, position: 9.1, change: -3.2 },
  { query: 'web design services', clicks: 750, impressions: 11200, ctr: 6.7, position: 12.3, change: 8.7 },
  { query: 'custom website', clicks: 650, impressions: 9800, ctr: 6.6, position: 15.2, change: -1.8 },
  { query: 'digital marketing', clicks: 540, impressions: 8900, ctr: 6.1, position: 18.7, change: 15.3 },
  { query: 'ecommerce development', clicks: 420, impressions: 7200, ctr: 5.8, position: 22.1, change: -5.4 },
  { query: 'wordpress plugins', clicks: 380, impressions: 6800, ctr: 5.6, position: 24.8, change: 9.2 },
  { query: 'responsive design', clicks: 320, impressions: 5900, ctr: 5.4, position: 28.3, change: -2.1 },
]

export function TopKeywords() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Keywords</CardTitle>
        <CardDescription>
          Best performing search queries from Google Search Console
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockKeywords.map((keyword, index) => (
            <div key={keyword.query} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{keyword.query}</p>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                      <span>{keyword.clicks.toLocaleString()} clicks</span>
                      <span>{keyword.impressions.toLocaleString()} impressions</span>
                      <span>{keyword.ctr}% CTR</span>
                      <span>Pos. {keyword.position}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className={`flex items-center text-xs ${keyword.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {keyword.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      <span className="font-medium">{Math.abs(keyword.change)}%</span>
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