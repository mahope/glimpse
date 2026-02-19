import crypto from 'crypto'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'crypto' })
const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || ''
  const isProd = process.env.NODE_ENV === 'production'
  if (key.length !== 32) {
    const msg = `ENCRYPTION_KEY must be exactly 32 bytes (ASCII). Current length: ${key.length}`
    if (isProd) {
      throw new Error(msg)
    } else {
      log.warn({ keyLength: key.length }, msg)
    }
  }
  // If shorter than 32 in dev, pad to avoid crypto throw; in prod we already threw
  const buf = Buffer.alloc(32)
  Buffer.from(key).copy(buf)
  return buf
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decrypt(payload: string): string {
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()])
  return plaintext.toString('utf8')
}
