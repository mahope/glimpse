export interface CrawlResult {
  url: string
  statusCode: number
  loadTimeMs: number
  title?: string
  metaDescription?: string
  h1Tags: string[]
  h2Tags: string[]
  images: ImageInfo[]
  links: LinkInfo[]
  wordCount: number
  contentLength: number
  issues: CrawlIssue[]
}

export interface CrawlIssue {
  type: 'error' | 'warning' | 'info'
  category: 'title' | 'description' | 'headings' | 'images' | 'links' | 'content' | 'performance' | 'technical'
  message: string
  element?: string
  recommendation?: string
  url?: string
}

export interface PageAnalysis {
  url: string
  statusCode: number
  loadTime: number
  seoIssues: CrawlIssue[]
  contentMetrics: ContentMetrics
  technicalMetrics: TechnicalMetrics
}

export interface ContentMetrics {
  title: TitleAnalysis
  metaDescription: MetaDescriptionAnalysis
  headings: HeadingAnalysis
  images: ImageAnalysis
  wordCount: number
  contentLength: number
}

export interface TechnicalMetrics {
  loadTime: number
  statusCode: number
  redirects: number
  robotsTxtBlocked: boolean
  canonicalIssues: string[]
  schemaMarkup: SchemaMarkupAnalysis
}

export interface TitleAnalysis {
  present: boolean
  length: number
  text?: string
  issues: string[]
}

export interface MetaDescriptionAnalysis {
  present: boolean
  length: number
  text?: string
  issues: string[]
}

export interface HeadingAnalysis {
  h1Count: number
  h2Count: number
  h3Count: number
  h4Count: number
  h5Count: number
  h6Count: number
  h1Text: string[]
  structure: HeadingStructureIssue[]
}

export interface HeadingStructureIssue {
  type: 'missing_h1' | 'multiple_h1' | 'skipped_level' | 'empty_heading'
  level?: number
  message: string
}

export interface ImageAnalysis {
  totalImages: number
  imagesWithAlt: number
  imagesWithoutAlt: number
  largeImages: ImageInfo[]
  brokenImages: ImageInfo[]
}

export interface ImageInfo {
  src: string
  alt?: string
  hasAlt: boolean
  width?: number
  height?: number
  fileSize?: number
  loading?: string
  broken?: boolean
}

export interface LinkInfo {
  href: string
  text: string
  title?: string
  isInternal: boolean
  isExternal: boolean
  isEmail: boolean
  isTelephone: boolean
  isNoFollow: boolean
  isNoIndex: boolean
  target?: string
  broken?: boolean
  redirects?: number
  finalUrl?: string
}

export interface SchemaMarkupAnalysis {
  present: boolean
  types: string[]
  errors: string[]
  warnings: string[]
}

export interface CrawlOptions {
  maxDepth?: number
  maxPages?: number
  respectRobotsTxt?: boolean
  delay?: number
  timeout?: number
  userAgent?: string
  followRedirects?: boolean
  checkBrokenLinks?: boolean
  analyzeSiteSpeed?: boolean
  includeExternalLinks?: boolean
}

export interface SiteCrawlSummary {
  siteId: string
  crawlDate: Date
  pagesAnalyzed: number
  totalIssues: number
  criticalIssues: number
  warningIssues: number
  infoIssues: number
  averageLoadTime: number
  averageWordCount: number
  overallScore: number
  recommendations: string[]
}

export interface IssueCategory {
  name: string
  count: number
  severity: 'critical' | 'warning' | 'info'
  issues: CrawlIssue[]
}

export interface CrawlStats {
  totalPages: number
  successfulPages: number
  errorPages: number
  redirectPages: number
  averageLoadTime: number
  slowestPages: string[]
  fastestPages: string[]
}

// Database types (matching Prisma schema)
export interface CrawlResultDB {
  id: string
  siteId: string
  crawlDate: Date
  url: string
  statusCode: number
  loadTimeMs: number
  title?: string
  metaDescription?: string
  h1Count: number
  h2Count: number
  totalImages: number
  imagesWithoutAlt: number
  wordCount: number
  contentLength: number
  totalLinks: number
  internalLinks: number
  externalLinks: number
  brokenLinks: number
  issues?: any // JSON field
  createdAt: Date
}

export interface RobotsTxtRules {
  allowed: boolean
  rules: {
    userAgent: string
    disallow: string[]
    allow: string[]
  }[]
  crawlDelay?: number
  sitemapUrls: string[]
}