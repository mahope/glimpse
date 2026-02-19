import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/crypto'

// Set a valid 32-byte encryption key for tests
beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'test-key-must-be-32-bytes-long!!'
})

describe('GSC token encryption roundtrip', () => {
  it('encrypt() -> decrypt() returns the original value', () => {
    const original = JSON.stringify({ refresh_token: '1//0abc-fake-token' })
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/) // base64 output
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('produces different ciphertexts for same input (random IV)', () => {
    const original = 'same-value'
    const a = encrypt(original)
    const b = encrypt(original)
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(original)
    expect(decrypt(b)).toBe(original)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('secret')
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered)).toThrow()
  })
})
