/**
 * T5.2T — Encryption utility tests
 *
 * AES-256-GCM encrypt/decrypt round-trip and security property tests.
 * All tests run with a real 64-hex-char key set in process.env.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"

const TEST_KEY = "a".repeat(64) // 64 hex chars = 32 bytes — NOT a secure key — unit tests only, never use in any .env file
const TEST_SALT = "test-iv-salt-value"

describe("encryption utility", () => {
  beforeEach(() => {
    process.env["ENCRYPTION_KEY"] = TEST_KEY
    process.env["ENCRYPTION_IV_SALT"] = TEST_SALT
  })

  afterEach(() => {
    delete process.env["ENCRYPTION_KEY"]
    delete process.env["ENCRYPTION_IV_SALT"]
  })

  it("encrypt returns a non-empty string different from the plaintext", async () => {
    const { encrypt } = await import("@/lib/encryption")
    const plaintext = "sk-anthropic-secret-key"
    const ciphertext = await encrypt(plaintext, "user_abc")

    expect(typeof ciphertext).toBe("string")
    expect(ciphertext.length).toBeGreaterThan(0)
    expect(ciphertext).not.toBe(plaintext)
  })

  it("decrypt returns the original plaintext", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption")
    const plaintext = "sk-anthropic-secret-key"
    const ciphertext = await encrypt(plaintext, "user_abc")

    const recovered = await decrypt(ciphertext, "user_abc")
    expect(recovered).toBe(plaintext)
  })

  it("same plaintext + same userId produces deterministic ciphertext", async () => {
    const { encrypt } = await import("@/lib/encryption")
    const a = await encrypt("my-api-key", "user_xyz")
    const b = await encrypt("my-api-key", "user_xyz")
    expect(a).toBe(b)
  })

  it("different userId produces different ciphertext (user-specific IV)", async () => {
    const { encrypt } = await import("@/lib/encryption")
    const a = await encrypt("my-api-key", "user_001")
    const b = await encrypt("my-api-key", "user_002")
    expect(a).not.toBe(b)
  })

  it("throws when encrypting an empty string", async () => {
    const { encrypt } = await import("@/lib/encryption")
    await expect(encrypt("", "user_abc")).rejects.toThrow("Cannot encrypt empty value")
  })

  it("throws when decrypting with wrong userId", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption")
    const ciphertext = await encrypt("secret-key", "user_correct")
    // Wrong userId → different IV → authentication tag fails
    await expect(decrypt(ciphertext, "user_wrong")).rejects.toThrow()
  })
})
