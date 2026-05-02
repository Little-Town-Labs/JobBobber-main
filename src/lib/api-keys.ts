import "server-only"
import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"

/**
 * Generate a new API key.
 *
 * Format: `jb_live_<base64url(32 random bytes)>`
 * The prefix "jb_live_" (8 chars) is always returned alongside the full raw
 * key so callers can store it for display purposes without keeping the secret.
 */
export function generateApiKey(): { raw: string; prefix: string } {
  const entropy = randomBytes(32).toString("base64url")
  const raw = `jb_live_${entropy}`
  const prefix = raw.slice(0, 8) // "jb_live_"
  return { raw, prefix }
}

/**
 * Hash a raw API key with SHA-256.
 * Only the hash is stored in the database; the raw value is never persisted.
 */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

/**
 * Look up an API key by its raw value.
 *
 * Returns the ApiKey record when the key exists and has not been revoked.
 * Returns null if the key is unknown or revoked.
 *
 * The lastUsedAt timestamp is updated as a fire-and-forget side-effect so
 * the update never adds latency to the authenticated request path.
 */
export async function lookupApiKey(raw: string) {
  const keyHash = hashApiKey(raw)
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } })

  if (!apiKey || apiKey.revokedAt !== null) return null

  // Fire-and-forget — intentionally not awaited
  void db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return apiKey
}
