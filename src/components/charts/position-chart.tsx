'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock data - replace with real API calls
const mockData = [
  { date: '2024-01-01', position: 15.2 },
  { date: '2024-01-02', position: 14.8 },
  { date: '2024-01-03', position: 13.9 },
  { date: '2024-01-04', position: 14.1 },
  { date: '2024-01-05', position: 13.5 },
  { date: '2024-01-06', position: 12.8 },
  { date: '2024-01-07', position: 13.2 },
  { date: '2024-01-08', position: 13.7 },
  { date: '2024-01-09', position: 12.9 },
  { date: '2024-01-10', position: 11.8 },
  { date: '2024-01-11', position: 12.3 },
  { date: '2024-01-12', position: 11.5 },
  { date: '2024-01-13', position: 10.9 },
  { date: '2024-01-14', position: 11.4 },
  { date: '2024-01-15', position: 10.7 },
]

export function PositionChart() {
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
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={['dataMin - 2', 'dataMax + 2']}
                reversed={true} // Lower position numbers are better
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
        </div>
      </CardContent>
    </Card>
  )
}