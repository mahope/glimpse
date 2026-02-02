import * as cheerio from 'cheerio'
import { 
  PageAnalysis, 
  CrawlIssue, 
  ContentMetrics, 
  TechnicalMetrics, 
  TitleAnalysis, 
  MetaDescriptionAnalysis,
  HeadingAnalysis,
  ImageAnalysis,
  ImageInfo,
  LinkInfo,
  SchemaMarkupAnalysis,
  HeadingStructureIssue
} from './types'

export class PageAnalyzer {
  
  /**
   * Perform comprehensive analysis of a crawled page
   */
  static analyzePageContent(
    html: string, 
    url: string, 
    statusCode: number, 
    loadTime: number
  ): PageAnalysis {
    const $ = cheerio.load(html)
    
    const contentMetrics = this.analyzeContent($, url)
    const technicalMetrics = this.analyzeTechnical($, url, statusCode, loadTime)
    
    // Collect all issues from different analyses
    const seoIssues: CrawlIssue[] = [
      ...this.getTitleIssues(contentMetrics.title, url),
      ...this.getMetaDescriptionIssues(contentMetrics.metaDescription, url),
      ...this.getHeadingIssues(contentMetrics.headings, url),
      ...this.getImageIssues(contentMetrics.images, url),
      ...this.getContentIssues(contentMetrics, url),
      ...this.getTechnicalIssues(technicalMetrics, url)
    ]

    return {
      url,
      statusCode,
      loadTime,
      seoIssues,
      contentMetrics,
      technicalMetrics
    }
  }

  /**
   * Analyze content-related metrics
   */
  private static analyzeContent($: cheerio.CheerioAPI, url: string): ContentMetrics {
    return {
      title: this.analyzeTitle($),
      metaDescription: this.analyzeMetaDescription($),
      headings: this.analyzeHeadings($),
      images: this.analyzeImages($, url),
      wordCount: this.countWords($),
      contentLength: this.getContentLength($)
    }
  }

  /**
   * Analyze technical metrics
   */
  private static analyzeTechnical(
    $: cheerio.CheerioAPI, 
    url: string, 
    statusCode: number, 
    loadTime: number
  ): TechnicalMetrics {
    return {
      loadTime,
      statusCode,
      redirects: 0, // Would need to track through fetch
      robotsTxtBlocked: false, // Would need separate robots.txt check
      canonicalIssues: this.analyzeCanonical($, url),
      schemaMarkup: this.analyzeSchemaMarkup($)
    }
  }

  /**
   * Analyze page title
   */
  private static analyzeTitle($: cheerio.CheerioAPI): TitleAnalysis {
    const titleElement = $('title')
    const titleText = titleElement.text().trim()
    const issues: string[] = []

    if (!titleText) {
      issues.push('No title tag found')
    } else {
      if (titleText.length < 30) {
        issues.push('Title is too short (less than 30 characters)')
      }
      if (titleText.length > 60) {
        issues.push('Title is too long (more than 60 characters)')
      }
      if (titleText.toLowerCase().includes('untitled')) {
        issues.push('Title appears to be placeholder text')
      }
    }

    // Check for duplicate titles (would need database comparison)
    
    return {
      present: !!titleText,
      length: titleText.length,
      text: titleText || undefined,
      issues
    }
  }

  /**
   * Analyze meta description
   */
  private static analyzeMetaDescription($: cheerio.CheerioAPI): MetaDescriptionAnalysis {
    const metaDesc = $('meta[name="description"]').attr('content')?.trim()
    const issues: string[] = []

    if (!metaDesc) {
      issues.push('No meta description found')
    } else {
      if (metaDesc.length < 120) {
        issues.push('Meta description is short (less than 120 characters)')
      }
      if (metaDesc.length > 160) {
        issues.push('Meta description is too long (more than 160 characters)')
      }
    }

    return {
      present: !!metaDesc,
      length: metaDesc?.length || 0,
      text: metaDesc,
      issues
    }
  }

  /**
   * Analyze heading structure
   */
  private static analyzeHeadings($: cheerio.CheerioAPI): HeadingAnalysis {
    const h1Elements = $('h1')
    const h2Elements = $('h2')
    const h3Elements = $('h3')
    const h4Elements = $('h4')
    const h5Elements = $('h5')
    const h6Elements = $('h6')

    const h1Text = h1Elements.map((i, el) => $(el).text().trim()).get()
    const structure: HeadingStructureIssue[] = []

    // Check for missing H1
    if (h1Elements.length === 0) {
      structure.push({
        type: 'missing_h1',
        message: 'No H1 tag found on page'
      })
    }

    // Check for multiple H1s
    if (h1Elements.length > 1) {
      structure.push({
        type: 'multiple_h1',
        message: `Multiple H1 tags found (${h1Elements.length})`
      })
    }

    // Check for empty headings
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const text = $(el).text().trim()
      if (!text) {
        const tagName = el.tagName.toUpperCase()
        structure.push({
          type: 'empty_heading',
          level: parseInt(tagName.substring(1)),
          message: `Empty ${tagName} tag found`
        })
      }
    })

    return {
      h1Count: h1Elements.length,
      h2Count: h2Elements.length,
      h3Count: h3Elements.length,
      h4Count: h4Elements.length,
      h5Count: h5Elements.length,
      h6Count: h6Elements.length,
      h1Text,
      structure
    }
  }

  /**
   * Analyze images
   */
  private static analyzeImages($: cheerio.CheerioAPI, url: string): ImageAnalysis {
    const images: ImageInfo[] = []
    const largeImages: ImageInfo[] = []
    const brokenImages: ImageInfo[] = []

    $('img').each((i, el) => {
      const $img = $(el)
      const src = $img.attr('src')
      const alt = $img.attr('alt')
      const width = parseInt($img.attr('width') || '0') || undefined
      const height = parseInt($img.attr('height') || '0') || undefined
      const loading = $img.attr('loading')

      if (src) {
        const imageInfo: ImageInfo = {
          src: this.resolveUrl(src, url),
          alt,
          hasAlt: !!alt && alt.trim().length > 0,
          width,
          height,
          loading,
          broken: false // Would need actual HTTP check
        }

        images.push(imageInfo)

        // Flag potentially large images
        if (width && height && width * height > 1000000) {
          largeImages.push(imageInfo)
        }
      }
    })

    const imagesWithAlt = images.filter(img => img.hasAlt).length
    const imagesWithoutAlt = images.length - imagesWithAlt

    return {
      totalImages: images.length,
      imagesWithAlt,
      imagesWithoutAlt,
      largeImages,
      brokenImages
    }
  }

  /**
   * Analyze canonical tags
   */
  private static analyzeCanonical($: cheerio.CheerioAPI, url: string): string[] {
    const issues: string[] = []
    const canonicalLinks = $('link[rel="canonical"]')

    if (canonicalLinks.length === 0) {
      issues.push('No canonical tag found')
    } else if (canonicalLinks.length > 1) {
      issues.push('Multiple canonical tags found')
    } else {
      const canonicalUrl = canonicalLinks.attr('href')
      if (!canonicalUrl) {
        issues.push('Canonical tag has no href attribute')
      } else if (!this.isValidUrl(canonicalUrl)) {
        issues.push('Canonical URL is not valid')
      }
    }

    return issues
  }

  /**
   * Analyze schema markup
   */
  private static analyzeSchemaMarkup($: cheerio.CheerioAPI): SchemaMarkupAnalysis {
    const jsonLdScripts = $('script[type="application/ld+json"]')
    const microdataElements = $('[itemtype]')
    
    const types: string[] = []
    const errors: string[] = []
    const warnings: string[] = []

    // Analyze JSON-LD
    jsonLdScripts.each((i, el) => {
      try {
        const content = $(el).html()
        if (content) {
          const schema = JSON.parse(content)
          if (schema['@type']) {
            types.push(schema['@type'])
          }
        }
      } catch (error) {
        errors.push('Invalid JSON-LD syntax found')
      }
    })

    // Analyze microdata
    microdataElements.each((i, el) => {
      const itemtype = $(el).attr('itemtype')
      if (itemtype) {
        const schemaType = itemtype.split('/').pop()
        if (schemaType && !types.includes(schemaType)) {
          types.push(schemaType)
        }
      }
    })

    return {
      present: types.length > 0,
      types,
      errors,
      warnings
    }
  }

  /**
   * Count words in page content
   */
  private static countWords($: cheerio.CheerioAPI): number {
    const bodyText = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!bodyText) return 0
    
    return bodyText.split(' ').filter(word => word.length > 0).length
  }

  /**
   * Get content length
   */
  private static getContentLength($: cheerio.CheerioAPI): number {
    return $('body').text().replace(/\s+/g, ' ').trim().length
  }

  /**
   * Generate issues from title analysis
   */
  private static getTitleIssues(titleAnalysis: TitleAnalysis, url: string): CrawlIssue[] {
    return titleAnalysis.issues.map(issue => ({
      type: titleAnalysis.present ? 'warning' : 'error',
      category: 'title',
      message: issue,
      element: titleAnalysis.text,
      recommendation: this.getTitleRecommendation(issue),
      url
    }))
  }

  /**
   * Generate issues from meta description analysis
   */
  private static getMetaDescriptionIssues(metaAnalysis: MetaDescriptionAnalysis, url: string): CrawlIssue[] {
    return metaAnalysis.issues.map(issue => ({
      type: metaAnalysis.present ? 'warning' : 'warning',
      category: 'description',
      message: issue,
      element: metaAnalysis.text,
      recommendation: this.getMetaDescriptionRecommendation(issue),
      url
    }))
  }

  /**
   * Generate issues from heading analysis
   */
  private static getHeadingIssues(headingAnalysis: HeadingAnalysis, url: string): CrawlIssue[] {
    return headingAnalysis.structure.map(issue => ({
      type: issue.type === 'missing_h1' ? 'error' : 'warning',
      category: 'headings',
      message: issue.message,
      recommendation: this.getHeadingRecommendation(issue.type),
      url
    }))
  }

  /**
   * Generate issues from image analysis
   */
  private static getImageIssues(imageAnalysis: ImageAnalysis, url: string): CrawlIssue[] {
    const issues: CrawlIssue[] = []

    if (imageAnalysis.imagesWithoutAlt > 0) {
      issues.push({
        type: 'warning',
        category: 'images',
        message: `${imageAnalysis.imagesWithoutAlt} images missing alt text`,
        recommendation: 'Add descriptive alt text to all images for better accessibility and SEO',
        url
      })
    }

    if (imageAnalysis.largeImages.length > 0) {
      issues.push({
        type: 'info',
        category: 'images',
        message: `${imageAnalysis.largeImages.length} potentially large images found`,
        recommendation: 'Consider optimizing large images for better performance',
        url
      })
    }

    return issues
  }

  /**
   * Generate issues from content metrics
   */
  private static getContentIssues(contentMetrics: ContentMetrics, url: string): CrawlIssue[] {
    const issues: CrawlIssue[] = []

    if (contentMetrics.wordCount < 300) {
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Content is quite short',
        recommendation: 'Consider adding more valuable content (aim for 300+ words) for better SEO',
        url
      })
    }

    if (contentMetrics.wordCount === 0) {
      issues.push({
        type: 'error',
        category: 'content',
        message: 'No readable content found',
        recommendation: 'Add meaningful text content to the page',
        url
      })
    }

    return issues
  }

  /**
   * Generate issues from technical metrics
   */
  private static getTechnicalIssues(technicalMetrics: TechnicalMetrics, url: string): CrawlIssue[] {
    const issues: CrawlIssue[] = []

    if (technicalMetrics.loadTime > 3000) {
      issues.push({
        type: 'warning',
        category: 'performance',
        message: `Slow page load time (${technicalMetrics.loadTime}ms)`,
        recommendation: 'Optimize page loading speed for better user experience',
        url
      })
    }

    if (technicalMetrics.statusCode >= 400) {
      issues.push({
        type: 'error',
        category: 'technical',
        message: `HTTP error: ${technicalMetrics.statusCode}`,
        recommendation: 'Fix server errors and broken pages',
        url
      })
    }

    technicalMetrics.canonicalIssues.forEach(issue => {
      issues.push({
        type: 'warning',
        category: 'technical',
        message: issue,
        recommendation: 'Fix canonical tag issues for proper indexing',
        url
      })
    })

    if (!technicalMetrics.schemaMarkup.present) {
      issues.push({
        type: 'info',
        category: 'technical',
        message: 'No structured data found',
        recommendation: 'Consider adding schema markup for rich snippets',
        url
      })
    }

    return issues
  }

  /**
   * Utility methods for recommendations
   */
  private static getTitleRecommendation(issue: string): string {
    if (issue.includes('too short')) {
      return 'Write a more descriptive title between 30-60 characters'
    }
    if (issue.includes('too long')) {
      return 'Shorten title to 30-60 characters to avoid truncation'
    }
    if (issue.includes('No title')) {
      return 'Add a unique, descriptive title tag to help search engines understand the page'
    }
    return 'Improve title tag for better SEO'
  }

  private static getMetaDescriptionRecommendation(issue: string): string {
    if (issue.includes('No meta description')) {
      return 'Add a compelling meta description between 120-160 characters'
    }
    if (issue.includes('too long')) {
      return 'Shorten meta description to 120-160 characters'
    }
    if (issue.includes('short')) {
      return 'Consider expanding meta description for better visibility'
    }
    return 'Improve meta description for better click-through rates'
  }

  private static getHeadingRecommendation(issueType: string): string {
    switch (issueType) {
      case 'missing_h1':
        return 'Add an H1 tag to clearly define the main topic of the page'
      case 'multiple_h1':
        return 'Use only one H1 tag per page for better SEO structure'
      case 'empty_heading':
        return 'Add descriptive text to heading tags'
      default:
        return 'Improve heading structure for better content organization'
    }
  }

  /**
   * Utility methods
   */
  private static resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href
    } catch {
      return href
    }
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}