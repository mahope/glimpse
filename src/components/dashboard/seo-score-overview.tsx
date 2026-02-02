'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  FileText, 
  Settings, 
  Search,
  Target,
  AlertCircle,
  CheckCircle,
  Info
} from "lucide-react"

interface SEOScoreData {
  overall: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  components: {
    performance: number
    content: number
    technical: number
    search: number
  }
  improvements: string[]
  strengths: string[]
  trend?: number // percentage change from last period
}

interface SEOScoreOverviewProps {
  data: SEOScoreData
  isLoading?: boolean
}

export function SEOScoreOverview({ data, isLoading }: SEOScoreOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>SEO Score</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-6 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200'
      case 'B':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'C':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'D':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'F':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const componentIcons = {
    performance: Zap,
    content: FileText,
    technical: Settings,
    search: Search
  }

  return (
    <div className="space-y-6">
      {/* Main Score Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>SEO Score</span>
              {data.trend && (
                <div className={`flex items-center text-sm ${data.trend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data.trend > 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(data.trend)}%
                </div>
              )}
            </CardTitle>
            <CardDescription>Overall SEO health assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(data.overall)}`}>
                {data.overall}
              </div>
              <div className="text-lg text-muted-foreground mb-4">out of 100</div>
              <Badge 
                variant="outline" 
                className={`text-lg px-3 py-1 ${getGradeColor(data.grade)}`}
              >
                Grade {data.grade}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>Individual component scores (0-25 each)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(data.components).map(([component, score]) => {
                const Icon = componentIcons[component as keyof typeof componentIcons]
                return (
                  <div key={component} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span className="capitalize font-medium">{component}</span>
                      </div>
                      <span className={`font-bold ${getScoreColor((score / 25) * 100)}`}>
                        {score}/25
                      </span>
                    </div>
                    <Progress 
                      value={(score / 25) * 100} 
                      className="h-2"
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Improvements and Strengths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Areas for Improvement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-orange-600" />
              <span>Areas for Improvement</span>
            </CardTitle>
            <CardDescription>
              Focus on these areas to boost your SEO score
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.improvements.length > 0 ? (
              <div className="space-y-3">
                {data.improvements.slice(0, 5).map((improvement, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{improvement}</span>
                  </div>
                ))}
                {data.improvements.length > 5 && (
                  <div className="text-sm text-muted-foreground">
                    +{data.improvements.length - 5} more recommendations
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">No major issues found!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span>Strengths</span>
            </CardTitle>
            <CardDescription>
              What's working well for your SEO
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.strengths.length > 0 ? (
              <div className="space-y-3">
                {data.strengths.slice(0, 5).map((strength, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{strength}</span>
                  </div>
                ))}
                {data.strengths.length > 5 && (
                  <div className="text-sm text-muted-foreground">
                    +{data.strengths.length - 5} more strengths
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Info className="h-4 w-4" />
                <span className="text-sm">Complete an SEO audit to identify strengths</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Mock data for development
export const mockSEOScoreData: SEOScoreData = {
  overall: 78,
  grade: 'B',
  components: {
    performance: 20,
    content: 18,
    technical: 22,
    search: 18
  },
  improvements: [
    'Optimize images to improve page loading speed',
    'Add meta descriptions to 12 pages',
    'Fix 3 pages with missing H1 tags',
    'Improve mobile performance scores',
    'Increase average content length for better rankings'
  ],
  strengths: [
    'Excellent technical SEO implementation',
    'Strong internal linking structure',
    'Most images have alt text',
    'Good organic click-through rates',
    'Fast server response times'
  ],
  trend: 5.2
}