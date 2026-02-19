export type SortField = 'clicks' | 'impressions' | 'ctr' | 'position' | 'positionDelta'
export type SortDir = 'asc' | 'desc'

export type PositionFilter = '' | 'top3' | 'top10' | 'top20' | '50plus'

export type ParsedParams = {
  days: number
  from?: string // YYYY-MM-DD (set when custom range)
  to?: string   // YYYY-MM-DD (set when custom range)
  page: number
  pageSize: number
  device: 'all' | 'desktop' | 'mobile'
  country: string // 'ALL' or ISO code
  sortField: SortField
  sortDir: SortDir
  search: string
  positionFilter: PositionFilter
}

const SORT_FIELDS: SortField[] = ['clicks','impressions','ctr','position','positionDelta']
const SORT_DIRS: SortDir[] = ['asc','desc']

export function parseParams(input: URLSearchParams | Record<string,string | number | undefined>): ParsedParams {
  const get = (k: string) => input instanceof URLSearchParams ? input.get(k) ?? undefined : (input as any)[k]

  // Support custom date range (from/to) or days
  const fromRaw = get('from')
  const toRaw = get('to')
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  let from: string | undefined
  let to: string | undefined
  let days: number

  if (typeof fromRaw === 'string' && typeof toRaw === 'string' && DATE_RE.test(fromRaw) && DATE_RE.test(toRaw)) {
    // Ensure from <= to
    from = fromRaw <= toRaw ? fromRaw : toRaw
    to = fromRaw <= toRaw ? toRaw : fromRaw
    const diff = Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
    days = Math.min(Math.max(diff, 1), 365)
  } else {
    const daysRaw = Number(get('days') ?? 30)
    days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 180 ? Math.floor(daysRaw) : 30
  }
  const pageRaw = Number(get('page') ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSizeRaw = Number(get('pageSize') ?? 50)
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 500 ? Math.floor(pageSizeRaw) : 50

  const deviceRaw = String((get('device') ?? 'all')).toLowerCase()
  const device = (deviceRaw === 'desktop' || deviceRaw === 'mobile') ? deviceRaw : 'all'
  const country = String((get('country') ?? 'ALL')).toUpperCase()

  const sortFieldRaw = String(get('sort') ?? get('sortField') ?? 'clicks')
  const sortField = (SORT_FIELDS as string[]).includes(sortFieldRaw) ? (sortFieldRaw as SortField)
    : (SORT_FIELDS as string[]).includes(sortFieldRaw.toLowerCase()) ? (sortFieldRaw.toLowerCase() as SortField) : 'clicks'
  const sortDirRaw = String(get('dir') ?? get('direction') ?? 'desc').toLowerCase()
  const sortDir = (SORT_DIRS as string[]).includes(sortDirRaw) ? (sortDirRaw as SortDir) : 'desc'

  const searchRaw = String(get('search') ?? '').trim()
  const search = searchRaw.length > 200 ? searchRaw.slice(0, 200) : searchRaw

  const posFilterRaw = String(get('positionFilter') ?? '').toLowerCase()
  const VALID_POS_FILTERS: PositionFilter[] = ['', 'top3', 'top10', 'top20', '50plus']
  const positionFilter = (VALID_POS_FILTERS as string[]).includes(posFilterRaw) ? (posFilterRaw as PositionFilter) : ''

  return { days, from, to, page, pageSize, device: device as any, country, sortField, sortDir, search, positionFilter }
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
