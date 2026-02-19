'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TimelinePoint {
  date: string
  position: number
}

export function PositionChart({ data }: { data: TimelinePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Position</CardTitle>
        <CardDescription>
          Average ranking position in search results (lower is better)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  reversed={true}
                />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                  formatter={(value) => [Number(value).toFixed(1), 'Position']}
                />
                <Line
                  type="monotone"
                  dataKey="position"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No data available yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
