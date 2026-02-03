export type SortField = 'clicks' | 'impressions' | 'ctr' | 'position'
export type SortDir = 'asc' | 'desc'

export type ParsedParams = {
  days: number
  page: number
  pageSize: number
  device: 'all' | 'desktop' | 'mobile'
  country: string // 'ALL' or ISO code
  sortField: SortField
  sortDir: SortDir
}

const SORT_FIELDS: SortField[] = ['clicks','impressions','ctr','position']
const SORT_DIRS: SortDir[] = ['asc','desc']

export function parseParams(input: URLSearchParams | Record<string,string | number | undefined>): ParsedParams {
  const get = (k: string) => input instanceof URLSearchParams ? input.get(k) ?? undefined : (input as any)[k]

  const daysRaw = Number(get('days') ?? 30)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 180 ? Math.floor(daysRaw) : 30
  const pageRaw = Number(get('page') ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSizeRaw = Number(get('pageSize') ?? 50)
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 500 ? Math.floor(pageSizeRaw) : 50

  const deviceRaw = String((get('device') ?? 'all')).toLowerCase()
  const device = (deviceRaw === 'desktop' || deviceRaw === 'mobile') ? deviceRaw : 'all'
  const country = String((get('country') ?? 'ALL')).toUpperCase()

  const sortFieldRaw = String(get('sort') ?? get('sortField') ?? 'clicks').toLowerCase()
  const sortField = (SORT_FIELDS as string[]).includes(sortFieldRaw) ? (sortFieldRaw as SortField) : 'clicks'
  const sortDirRaw = String(get('dir') ?? get('direction') ?? 'desc').toLowerCase()
  const sortDir = (SORT_DIRS as string[]).includes(sortDirRaw) ? (sortDirRaw as SortDir) : 'desc'

  return { days, page, pageSize, device: device as any, country, sortField, sortDir }
}

export function safePctDelta(curr: number, prev: number): number {
  if (!isFinite(curr)) curr = 0
  if (!isFinite(prev)) prev = 0
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / Math.abs(prev)) * 100
}

export function ctr(clicks: number, impressions: number): number {
  if (!impressions || impressions <= 0) return 0
  return (clicks / impressions) * 100
}

// For position, lower is better. Positive means improvement.
export function positionImprovementPct(currPos: number, prevPos: number): number {
  if (!isFinite(currPos)) currPos = 0
  if (!isFinite(prevPos)) prevPos = 0
  if (prevPos === 0) return currPos === 0 ? 0 : 100
  return ((prevPos - currPos) / Math.abs(prevPos)) * 100
}
