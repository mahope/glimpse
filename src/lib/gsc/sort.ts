export type SortableItem = {
  clicks30: number
  impressions30: number
  ctr30: number
  position30: number
  // stable keys:
  key: string
}

export type SortField = 'clicks' | 'impressions' | 'ctr' | 'position'
export type SortDir = 'asc' | 'desc'

// Tie-breaker order for deterministic pagination:
// - when sorting by ctr: clicks desc, impressions desc, key asc
// - when sorting by clicks: impressions desc, key asc
// - when sorting by impressions: clicks desc, key asc
// - when sorting by position (lower better): clicks desc, impressions desc, key asc
export function sortItems(items: SortableItem[], field: SortField, dir: SortDir): SortableItem[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const primaryA = field === 'clicks' ? a.clicks30
      : field === 'impressions' ? a.impressions30
      : field === 'ctr' ? a.ctr30
      : a.position30
    const primaryB = field === 'clicks' ? b.clicks30
      : field === 'impressions' ? b.impressions30
      : field === 'ctr' ? b.ctr30
      : b.position30

    // for position: lower is better so invert comparison when dir is 'desc'
    const positionMultiplier = field === 'position' ? -1 : 1

    if (primaryA !== primaryB) return (primaryA < primaryB ? -1 : 1) * sign * positionMultiplier

    // tie-breakers
    if (field === 'ctr' || field === 'position') {
      if (a.clicks30 !== b.clicks30) return (a.clicks30 < b.clicks30 ? -1 : 1) * -1 // clicks desc
      if (a.impressions30 !== b.impressions30) return (a.impressions30 < b.impressions30 ? -1 : 1) * -1 // impr desc
      return a.key.localeCompare(b.key)
    }
    if (field === 'clicks') {
      if (a.impressions30 !== b.impressions30) return (a.impressions30 < b.impressions30 ? -1 : 1) * -1
      return a.key.localeCompare(b.key)
    }
    // impressions
    if (a.clicks30 !== b.clicks30) return (a.clicks30 < b.clicks30 ? -1 : 1) * -1
    return a.key.localeCompare(b.key)
  })
}
