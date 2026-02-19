import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Keyword {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function TopKeywords({ data }: { data: Keyword[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Keywords</CardTitle>
        <CardDescription>
          Best performing search queries across all sites
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((keyword) => (
              <div key={keyword.query} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium text-sm">{keyword.query}</p>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                    <span>{keyword.clicks.toLocaleString()} clicks</span>
                    <span>{keyword.impressions.toLocaleString()} impr.</span>
                    <span>{Math.round(keyword.ctr * 10) / 10}% CTR</span>
                    <span>Pos. {Math.round(keyword.position * 10) / 10}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No keyword data available yet</p>
        )}
      </CardContent>
    </Card>
  )
}
