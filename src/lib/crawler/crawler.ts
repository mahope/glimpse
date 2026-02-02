import * as cheerio from 'cheerio'
import fetch from 'node-fetch'

export interface CrawlResult {
  url: string
  statusCode: number
  title?: string
  metaDescription?: string
  h1Tags: string[]
  h2Tags: string[]
  images: ImageInfo[]
  links: LinkInfo[]
  loadTime: number
  issues: SEOIssue[]
  wordCount: number
  contentLength: number
}

export interface ImageInfo {
  src: string
  alt?: string
  hasAlt: boolean
  width?: number
  height?: number
}

export interface LinkInfo {
  href: string
  text: string
  isInternal: boolean
  isNoFollow: boolean
}

export interface SEOIssue {
  type: 'error' | 'warning' | 'info'
  category: 'title' | 'description' | 'headings' | 'images' | 'links' | 'content' | 'performance'
  message: string
  element?: string
  recommendation?: string
}

export interface CrawlOptions {
  maxDepth?: number
  maxPages?: number
  respectRobotsTxt?: boolean
  delay?: number
  userAgent?: string
  followRedirects?: boolean
  timeout?: number
}

export class WebCrawler {
  private userAgent: string
  private timeout: number
  private followRedirects: boolean

  constructor(options: CrawlOptions = {}) {
    this.userAgent = options.userAgent || 'Glimpse SEO Crawler/1.0'
    this.timeout = options.timeout || 10000
    this.followRedirects = options.followRedirects !== false
  }

  /**
   * Crawl a single page and analyze it for SEO issues
   */
  async crawlPage(url: string): Promise<CrawlResult> {
    const startTime = Date.now()
    let statusCode = 0
    let html = ''

    try {
      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: this.timeout,
        redirect: this.followRedirects ? 'follow' : 'manual'
      })

      statusCode = response.status
      html = await response.text()

    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const loadTime = Date.now() - startTime

    // Parse HTML
    const $ = cheerio.load(html)

    // Extract basic SEO data
    const title = $('title').text().trim()
    const metaDescription = $('meta[name="description"]').attr('content')?.trim()
    
    // Extract heading tags
    const h1Tags = $('h1').map((i, el) => $(el).text().trim()).get()
    const h2Tags = $('h2').map((i, el) => $(el).text().trim()).get()

    // Extract images
    const images: ImageInfo[] = $('img').map((i, el) => {
      const $img = $(el)
      const src = $img.attr('src') || ''
      const alt = $img.attr('alt')
      
      return {
        src,
        alt,
        hasAlt: !!alt && alt.trim().length > 0,
        width: parseInt($img.attr('width') || '0') || undefined,
        height: parseInt($img.attr('height') || '0') || undefined
      }
    }).get()

    // Extract links
    const links: LinkInfo[] = $('a[href]').map((i, el) => {
      const $link = $(el)
      const href = $link.attr('href') || ''
      const text = $link.text().trim()
      const isInternal = this.isInternalLink(href, url)
      const isNoFollow = $link.attr('rel')?.includes('nofollow') || false

      return {
        href,
        text,
        isInternal,
        isNoFollow
      }
    }).get()

    // Calculate content metrics
    const textContent = $('body').text().replace(/\s+/g, ' ').trim()
    const wordCount = textContent.split(' ').filter(word => word.length > 0).length
    const contentLength = textContent.length

    // Analyze for SEO issues
    const issues = this.analyzeSEOIssues($, {
      url,
      title,
      metaDescription,
      h1Tags,
      h2Tags,
      images,
      links,
      wordCount,
      contentLength
    })

    return {
      url,
      statusCode,
      title,
      metaDescription,
      h1Tags,
      h2Tags,
      images,
      links,
      loadTime,
      issues,
      wordCount,
      contentLength
    }
  }

  /**
   * Crawl multiple pages starting from a root URL
   */
  async crawlSite(rootUrl: string, options: CrawlOptions = {}): Promise<CrawlResult[]> {
    const maxDepth = options.maxDepth || 2
    const maxPages = options.maxPages || 50
    const delay = options.delay || 1000

    const visited = new Set<string>()
    const results: CrawlResult[] = []
    const queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }]

    while (queue.length > 0 && results.length < maxPages) {
      const { url, depth } = queue.shift()!

      if (visited.has(url) || depth > maxDepth) {
        continue
      }

      visited.add(url)

      try {
        console.log(`Crawling: ${url} (depth: ${depth})`)
        
        const result = await this.crawlPage(url)
        results.push(result)

        // Add internal links to queue for next depth level
        if (depth < maxDepth) {
          const internalLinks = result.links
            .filter(link => link.isInternal && !visited.has(this.resolveUrl(link.href, url)))
            .map(link => ({
              url: this.resolveUrl(link.href, url),
              depth: depth + 1
            }))

          queue.push(...internalLinks)
        }

        // Respect delay between requests
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }

      } catch (error) {
        console.error(`Error crawling ${url}:`, error)
        // Continue with other pages
      }
    }

    return results
  }

  /**
   * Analyze a page for common SEO issues
   */
  private analyzeSEOIssues($: cheerio.CheerioAPI, data: Partial<CrawlResult>): SEOIssue[] {
    const issues: SEOIssue[] = []

    // Title tag issues
    if (!data.title) {
      issues.push({
        type: 'error',
        category: 'title',
        message: 'Missing title tag',
        recommendation: 'Add a descriptive title tag to help search engines understand the page content'
      })
    } else {
      if (data.title.length < 30) {
        issues.push({
          type: 'warning',
          category: 'title',
          message: 'Title tag is too short',
          element: data.title,
          recommendation: 'Title should be 30-60 characters long for optimal SEO'
        })
      } else if (data.title.length > 60) {
        issues.push({
          type: 'warning',
          category: 'title',
          message: 'Title tag is too long',
          element: data.title,
          recommendation: 'Title should be 30-60 characters long to avoid truncation in search results'
        })
      }
    }

    // Meta description issues
    if (!data.metaDescription) {
      issues.push({
        type: 'warning',
        category: 'description',
        message: 'Missing meta description',
        recommendation: 'Add a meta description to improve click-through rates from search results'
      })
    } else {
      if (data.metaDescription.length < 120) {
        issues.push({
          type: 'info',
          category: 'description',
          message: 'Meta description is quite short',
          element: data.metaDescription,
          recommendation: 'Consider making it 120-160 characters for better search result visibility'
        })
      } else if (data.metaDescription.length > 160) {
        issues.push({
          type: 'warning',
          category: 'description',
          message: 'Meta description is too long',
          element: data.metaDescription,
          recommendation: 'Meta description should be 120-160 characters to avoid truncation'
        })
      }
    }

    // H1 tag issues
    if (!data.h1Tags || data.h1Tags.length === 0) {
      issues.push({
        type: 'error',
        category: 'headings',
        message: 'Missing H1 tag',
        recommendation: 'Add an H1 tag to clearly define the main topic of the page'
      })
    } else if (data.h1Tags.length > 1) {
      issues.push({
        type: 'warning',
        category: 'headings',
        message: `Multiple H1 tags found (${data.h1Tags.length})`,
        recommendation: 'Use only one H1 tag per page for better SEO structure'
      })
    }

    // Image alt text issues
    if (data.images) {
      const imagesWithoutAlt = data.images.filter(img => !img.hasAlt)
      if (imagesWithoutAlt.length > 0) {
        issues.push({
          type: 'warning',
          category: 'images',
          message: `${imagesWithoutAlt.length} image(s) missing alt text`,
          recommendation: 'Add descriptive alt text to all images for better accessibility and SEO'
        })
      }
    }

    // Content length issues
    if (data.wordCount && data.wordCount < 300) {
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Content is quite short',
        recommendation: 'Consider adding more valuable content (aim for 300+ words) to improve SEO'
      })
    }

    // Performance issues
    if (data.loadTime && data.loadTime > 3000) {
      issues.push({
        type: 'warning',
        category: 'performance',
        message: 'Slow page load time',
        recommendation: 'Optimize page loading speed for better user experience and SEO'
      })
    }

    return issues
  }

  /**
   * Check if a link is internal to the site
   */
  private isInternalLink(href: string, baseUrl: string): boolean {
    try {
      // Handle relative URLs
      if (href.startsWith('/')) return true
      if (href.startsWith('./') || href.startsWith('../')) return true
      if (!href.includes('://')) return true

      const baseDomain = new URL(baseUrl).hostname
      const linkDomain = new URL(href).hostname
      
      return baseDomain === linkDomain
    } catch {
      return false
    }
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href
    } catch {
      return href
    }
  }
}

/**
 * Helper function to categorize issues by severity
 */
export function categorizeIssues(issues: SEOIssue[]) {
  const errors = issues.filter(issue => issue.type === 'error')
  const warnings = issues.filter(issue => issue.type === 'warning')
  const info = issues.filter(issue => issue.type === 'info')

  return {
    errors: { count: errors.length, issues: errors },
    warnings: { count: warnings.length, issues: warnings },
    info: { count: info.length, issues: info }
  }
}

/**
 * Helper function to get overall SEO score based on issues
 */
export function calculateSEOScore(issues: SEOIssue[]): number {
  const { errors, warnings, info } = categorizeIssues(issues)
  
  // Start with perfect score
  let score = 100
  
  // Deduct points for issues
  score -= errors.count * 10 // 10 points per error
  score -= warnings.count * 5 // 5 points per warning
  score -= info.count * 1 // 1 point per info

  // Ensure score doesn't go below 0
  return Math.max(0, score)
}