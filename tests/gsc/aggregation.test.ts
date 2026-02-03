import { describe, it } from 'vitest'

// Integration test placeholder for aggregation queries against DB.
// Skipped by default to keep CI/local runs green when Postgres is unavailable.

describe.skip('Aggregation routes (integration)', () => {
  it('groups by query and pageUrl (integration)', () => {
    // Covered via API routes and Prisma groupBy in application code.
  })
})
