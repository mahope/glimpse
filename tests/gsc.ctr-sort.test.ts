import { describe, it, expect } from 'vitest'
import { sortItems } from '@/lib/gsc/sort'

describe('CTR sort behavior', () => {
  it('sorts by computed ctr with tie-breakers', () => {
    const items = [
      { key: 'a', clicks30: 10, impressions30: 100, ctr30: 10, position30: 5 },
      { key: 'b', clicks30: 5, impressions30: 25, ctr30: 20, position30: 7 },
      { key: 'c', clicks30: 8, impressions30: 80, ctr30: 10, position30: 9 },
      { key: 'd', clicks30: 1, impressions30: 2, ctr30: 50, position30: 3 },
    ]
    const sortedDesc = sortItems(items, 'ctr', 'desc')
    expect(sortedDesc.map(i=>i.key)).toEqual(['d','b','a','c'])

    const sortedAsc = sortItems(items, 'ctr', 'asc')
    expect(sortedAsc.map(i=>i.key)).toEqual(['a','c','b','d'])
  })

  it('deterministic with ties using clicks,impr,key', () => {
    const items = [
      { key: 'x', clicks30: 10, impressions30: 100, ctr30: 10, position30: 1 },
      { key: 'y', clicks30: 10, impressions30: 100, ctr30: 10, position30: 2 },
      { key: 'z', clicks30: 9, impressions30: 90, ctr30: 10, position30: 3 },
    ]
    const sorted = sortItems(items, 'ctr', 'desc')
    expect(sorted.map(i=>i.key)).toEqual(['x','y','z'])
  })
})
