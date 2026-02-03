#!/usr/bin/env tsx

/**
 * Background job worker startup script
 * 
 * This script starts all BullMQ workers for processing background jobs.
 * Run this as a separate process alongside your Next.js application.
 * 
 * Usage:
 *   npm run workers
 *   or
 *   npx tsx scripts/start-workers.ts
 */

import { config } from 'dotenv'
import path from 'path'

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') })
config({ path: path.resolve(process.cwd(), '.env') })

// Import workers after env is loaded
import { startAllWorkers } from '../src/lib/jobs'

startAllWorkers()

console.log('🚀 Background workers started successfully!')
console.log('🎯 Monitoring queues:')
console.log('  - gsc:fetch (GSC data synchronization)')
console.log('')
console.log('📊 Redis connection:', process.env.REDIS_URL || 'not configured')
console.log('🗄️  Database connection:', process.env.DATABASE_URL ? 'Configured' : 'Not configured')
console.log('')
console.log('Press Ctrl+C to stop workers')

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down workers...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down workers...')
  process.exit(0)
})

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})