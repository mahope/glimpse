/**
 * TypeScript types for Google Search Console API data
 * Based on GSC API v1 specification
 */

// ===========================================
// Core GSC API Response Types
// ===========================================

export interface GSCApiResponse<T = any> {
  rows?: T[]
  responseAggregationType?: 'auto' | 'byProperty' | 'byPage'
}

export interface GSCRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export interface GSCDimensionFilter {
  dimension: GSCDimension
  operator: GSCFilterOperator
  expression: string
}

export interface GSCDimensionFilterGroup {
  filters: GSCDimensionFilter[]
  groupType: 'and'
}

// ===========================================
// Request Types
// ===========================================

export interface GSCSearchAnalyticsQuery {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  dimensions?: GSCDimension[]
  dimensionFilterGroups?: GSCDimensionFilterGroup[]
  aggregationType?: 'auto' | 'byProperty' | 'byPage'
  rowLimit?: number // max 25,000
  startRow?: number // 0-based
  dataState?: 'final' | 'fresh' | 'all'
}

export interface GSCSitemapsListResponse {
  sitemap?: GSCSitemap[]
}

export interface GSCSitemap {
  path?: string
  lastSubmitted?: string
  isPending?: boolean
  isSitemapsIndex?: boolean
  type?: 'androidApp' | 'iosApp' | 'web'
  lastDownloaded?: string
  warnings?: number
  errors?: number
  contents?: GSCSitemapContent[]
}

export interface GSCSitemapContent {
  type?: string
  submitted?: number
  indexed?: number
}

// ===========================================
// Enum Types
// ===========================================

export type GSCDimension = 
  | 'query'
  | 'page' 
  | 'country'
  | 'device'
  | 'searchAppearance'
  | 'date'

export type GSCFilterOperator =
  | 'equals'
  | 'notEquals'  
  | 'contains'
  | 'notContains'
  | 'includingRegex'
  | 'excludingRegex'

export type GSCDevice = 'DESKTOP' | 'MOBILE' | 'TABLET'

export type GSCSearchAppearance = 
  | 'ANDROID_APP'
  | 'DISCOVER'
  | 'GOOGLE_NEWS'
  | 'IMAGE'
  | 'JOB_LISTING'
  | 'RECIPE'
  | 'VIDEO'
  | 'WEB'

// ===========================================
// Processed Data Types (Our Domain Models)
// ===========================================

export interface ProcessedGSCData {
  siteUrl: string
  dateRange: {
    startDate: string
    endDate: string
  }
  totalClicks: number
  totalImpressions: number
  averageCTR: number
  averagePosition: number
  queries: ProcessedQuery[]
  pages: ProcessedPage[]
  countries: ProcessedCountry[]
  devices: ProcessedDevice[]
  timeline: ProcessedTimelineData[]
}

export interface ProcessedQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  pages?: string[]
  trend?: 'up' | 'down' | 'stable'
  clicksChange?: number
  impressionsChange?: number
}

export interface ProcessedPage {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  queries?: string[]
  trend?: 'up' | 'down' | 'stable'
  clicksChange?: number
  impressionsChange?: number
}

export interface ProcessedCountry {
  country: string
  countryName: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface ProcessedDevice {
  device: GSCDevice
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface ProcessedTimelineData {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// ===========================================
// Database Sync Types
// ===========================================

export interface GSCSyncJob {
  id: string
  siteId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startDate: string
  endDate: string
  dimensions: GSCDimension[]
  recordsProcessed: number
  recordsInserted: number
  recordsUpdated: number
  errors: string[]
  startedAt: Date
  completedAt?: Date
  lastSyncCursor?: string
}

export interface GSCSyncConfig {
  siteId: string
  enabled: boolean
  dimensions: GSCDimension[]
  maxRowsPerRequest: number
  syncInterval: 'daily' | 'weekly' | 'manual'
  retentionDays: number
  lastSuccessfulSync?: Date
}

export interface GSCSyncResult {
  success: boolean
  recordsProcessed: number
  recordsInserted: number
  recordsUpdated: number
  errors: string[]
  duration: number
  nextCursor?: string
}

// ===========================================
// Error Types
// ===========================================

export interface GSCError extends Error {
  code?: string
  status?: number
  details?: any
}

export class GSCAuthError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'GSCAuthError'
  }
}

export class GSCQuotaError extends Error {
  constructor(message: string, public quotaUser?: string) {
    super(message)
    this.name = 'GSCQuotaError'
  }
}

export class GSCValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'GSCValidationError'
  }
}

// ===========================================
// Utility Types
// ===========================================

export interface CountryCodeMap {
  [code: string]: string
}

export interface GSCMetrics {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GSCAggregatedMetrics = GSCMetrics & {
  totalQueries: number
  totalPages: number
}

export interface GSCDateRange {
  startDate: string
  endDate: string
  isComplete: boolean
}

export interface GSCBatchRequest {
  queries: GSCSearchAnalyticsQuery[]
  maxConcurrency?: number
  rateLimitDelay?: number
}

export interface GSCBatchResult {
  results: ProcessedGSCData[]
  errors: GSCError[]
  totalDuration: number
}

// ===========================================
// Hook Types for React Components
// ===========================================

export interface UseGSCDataOptions {
  siteId: string
  startDate: string
  endDate: string
  dimensions?: GSCDimension[]
  refreshInterval?: number
  enabled?: boolean
}

export interface UseGSCDataResult {
  data?: ProcessedGSCData
  isLoading: boolean
  error?: GSCError
  refetch: () => Promise<void>
  lastUpdated?: Date
}