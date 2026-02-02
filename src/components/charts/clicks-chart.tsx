'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock data - replace with real API calls
const mockData = [
  { date: '2024-01-01', clicks: 420 },
  { date: '2024-01-02', clicks: 380 },
  { date: '2024-01-03', clicks: 510 },
  { date: '2024-01-04', clicks: 470 },
  { date: '2024-01-05', clicks: 520 },
  { date: '2024-01-06', clicks: 680 },
  { date: '2024-01-07', clicks: 610 },
  { date: '2024-01-08', clicks: 590 },
  { date: '2024-01-09', clicks: 640 },
  { date: '2024-01-10', clicks: 720 },
  { date: '2024-01-11', clicks: 670 },
  { date: '2024-01-12', clicks: 750 },
  { date: '2024-01-13', clicks: 810 },
  { date: '2024-01-14', clicks: 730 },
  { date: '2024-01-15', clicks: 780 },
]

export function ClicksChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clicks Over Time</CardTitle>
        <CardDescription>
          Daily clicks from Google Search Console
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
                formatter={(value) => [value, 'Clicks']}
              />
              <Line 
                type="monotone" 
                dataKey="clicks" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}