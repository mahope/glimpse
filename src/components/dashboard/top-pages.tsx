import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"

interface PageData {
  pageUrl: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function TopPages({ data }: { data: PageData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
        <CardDescription>
          Best performing pages across all sites
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((page) => (
              <div key={page.pageUrl} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-sm truncate">{page.pageUrl}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                    <span>{page.clicks.toLocaleString()} clicks</span>
                    <span>{page.impressions.toLocaleString()} impr.</span>
                    <span>{Math.round(page.ctr * 10) / 10}% CTR</span>
                    <span>Pos. {Math.round(page.position * 10) / 10}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No page data available yet</p>
        )}
      </CardContent>
    </Card>
  )
}
