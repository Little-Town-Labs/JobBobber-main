import "server-only"
import { createCipheriv, createDecipheriv, createHmac } from "crypto"

/**
 * AES-256-GCM encryption for BYOK (Bring Your Own Key) API key storage.
 *
 * This module encrypts user-provided LLM API keys before storing them in
 * SeekerSettings.byokApiKeyEncrypted and JobSettings.byokApiKeyEncrypted.
 *
 * Security model:
 *   - Key:  ENCRYPTION_KEY env var (64 hex chars = 32 bytes). Never logs, never returns.
 *   - IV:   HMAC-SHA256(ENCRYPTION_IV_SALT, userId), first 12 bytes.
 *           Deterministic per user — same userId always produces the same IV.
 *           This is intentional: rotating keys requires re-encrypting all records,
 *           which is handled by a dedicated key-rotation job (Feature 5).
 *   - Mode: AES-256-GCM — provides authenticated encryption (tamper detection via authTag).
 *
 * Ciphertext format (base64-encoded):
 *   iv(12 bytes) || authTag(16 bytes) || encryptedData(n bytes)
 *
 * @see data-model.md → BYOK Architecture section
 * @see tests/unit/lib/encryption.test.ts
 *
 * // SECURITY NOTE: Deterministic IV (same userId always maps to same IV) is a known
 * // trade-off. It means that two different plaintexts encrypted for the same user
 * // produce IVs from the same key stream start point. For BYOK single-key-per-user
 * // semantics this is acceptable; a user only has one BYOK key at a time.
 * // If semantics change (multiple keys per user), switch to random IV + store IV
 * // alongside the ciphertext.
 */

const ALGORITHM = "aes-256-gcm" as const
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

function getKey(): Buffer {
  const hex = process.env["ENCRYPTION_KEY"]
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
  }
  return Buffer.from(hex, "hex")
}

function deriveIv(userId: string): Buffer {
  const salt = process.env["ENCRYPTION_IV_SALT"]
  if (!salt) {
    throw new Error("ENCRYPTION_IV_SALT is required")
  }
  const hmac = createHmac("sha256", salt)
  hmac.update(userId)
  return hmac.digest().subarray(0, IV_BYTES)
}

/**
 * Encrypt a plaintext string for a specific user.
 * Returns a base64-encoded string: iv(12) + authTag(16) + ciphertext.
 *
 * @throws Error if plaintext is empty
 */
export async function encrypt(plaintext: string, userId: string): Promise<string> {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty value")
  }

  const key = getKey()
  const iv = deriveIv(userId)
  // WARNING: IV is deterministic per userId. Only safe if one plaintext is ever
  // encrypted per userId. See module-level SECURITY NOTE before extending.
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack: iv || authTag || encrypted
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString("base64")
}

/**
 * Decrypt a ciphertext string for a specific user.
 * The userId must match the one used during encryption (determines IV).
 *
 * @throws Error if decryption fails (wrong userId, tampered ciphertext, etc.)
 */
export async function decrypt(ciphertext: string, _userId: string): Promise<string> {
  const packed = Buffer.from(ciphertext, "base64")

  const iv = packed.subarray(0, IV_BYTES)
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const encrypted = packed.subarray(IV_BYTES + AUTH_TAG_BYTES)

  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}
