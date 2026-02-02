interface PageSpeedApiResponse {
  id: string
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: number }
      INTERACTION_TO_NEXT_PAINT: { percentile: number }
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: number }
      FIRST_CONTENTFUL_PAINT_MS: { percentile: number }
    }
  }
  lighthouseResult: {
    categories: {
      performance: { score: number }
    }
    audits: {
      'server-response-time': {
        numericValue: number
      }
      'largest-contentful-paint': {
        numericValue: number
      }
      'interaction-to-next-paint': {
        numericValue: number
      }
      'cumulative-layout-shift': {
        numericValue: number
      }
      'first-contentful-paint': {
        numericValue: number
      }
      'speed-index': {
        numericValue: number
      }
    }
    lighthouseVersion: string
  }
}

export interface PerformanceMetrics {
  score: number
  lcp: number
  inp: number
  cls: number
  ttfb: number
  fcp: number
  speedIndex: number
  lighthouseVersion: string
}

export class PageSpeedClient {
  private apiKey: string | null
  private baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  async runPerformanceTest(
    url: string,
    device: 'mobile' | 'desktop' = 'mobile'
  ): Promise<PerformanceMetrics> {
    try {
      const params = new URLSearchParams({
        url: url,
        strategy: device,
        category: 'performance',
        ...(this.apiKey && { key: this.apiKey }),
      })

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.status} ${response.statusText}`)
      }

      const data: PageSpeedApiResponse = await response.json()
      
      return this.extractMetrics(data)
    } catch (error) {
      console.error('Error running PageSpeed test:', error)
      throw error
    }
  }

  private extractMetrics(data: PageSpeedApiResponse): PerformanceMetrics {
    const { lighthouseResult } = data
    const { audits, categories } = lighthouseResult

    return {
      score: Math.round((categories.performance?.score || 0) * 100),
      lcp: this.convertToSeconds(audits['largest-contentful-paint']?.numericValue || 0),
      inp: audits['interaction-to-next-paint']?.numericValue || 0,
      cls: audits['cumulative-layout-shift']?.numericValue || 0,
      ttfb: audits['server-response-time']?.numericValue || 0,
      fcp: this.convertToSeconds(audits['first-contentful-paint']?.numericValue || 0),
      speedIndex: this.convertToSeconds(audits['speed-index']?.numericValue || 0),
      lighthouseVersion: lighthouseResult.lighthouseVersion,
    }
  }

  private convertToSeconds(milliseconds: number): number {
    return Number((milliseconds / 1000).toFixed(2))
  }
}

// Singleton instance
export const pageSpeedClient = new PageSpeedClient(
  process.env.GOOGLE_PAGESPEED_API_KEY
)