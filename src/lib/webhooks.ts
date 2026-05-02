import "server-only"
import { createHmac, randomBytes } from "crypto"
import { isIP } from "net"
import { lookup } from "dns/promises"
import { db } from "@/lib/db"
import { type WebhookEvent } from "@prisma/client"

/**
 * Returns true when the supplied IP literal sits inside any range that must
 * never be reachable from a webhook delivery: RFC 1918 private space,
 * loopback, link-local, CGNAT, IPv4-mapped IPv6, unique-local IPv6, and
 * the IPv6 loopback / unspecified addresses.
 *
 * Blocking these prevents SSRF against:
 *   - Cloud metadata services (169.254.169.254 — AWS/GCP/Azure)
 *   - Internal admin panels on RFC 1918 networks
 *   - Local services bound to 127.0.0.1 (Redis, Postgres, etc.)
 */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 0) return true // not a valid IP — refuse rather than risk

  if (family === 4) {
    const parts = ip.split(".").map((p) => Number.parseInt(p, 10))
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true
    const [a, b] = parts as [number, number, number, number]
    if (a === 10) return true // 10.0.0.0/8
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 0) return true // 0.0.0.0/8 "this network"
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
    if (a >= 224) return true // multicast + reserved
    return false
  }

  // IPv6
  const lower = ip.toLowerCase()
  if (lower === "::1" || lower === "::") return true // loopback / unspecified
  if (lower.startsWith("fe80:")) return true // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true // unique-local fc00::/7
  if (lower.startsWith("ff")) return true // multicast
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped — recurse on the embedded v4 address
    const v4 = lower.slice("::ffff:".length)
    return isBlockedIp(v4)
  }
  return false
}

/**
 * Validate a webhook URL: must be HTTPS, must resolve to a public IP.
 *
 * This is called both at registration time (to reject obvious mistakes) and
 * at delivery time (to defeat DNS rebinding — a hostname that resolved to a
 * public IP at registration could resolve to 127.0.0.1 later).
 *
 * Throws an Error with a user-safe message on rejection.
 */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error("Invalid webhook URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS")
  }

  const host = parsed.hostname
  // If the host is already an IP literal, check it directly.
  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new Error("Webhook URL must not point to a private or loopback address")
    }
    return
  }

  // Reject obvious local hostnames before DNS lookup.
  const lowerHost = host.toLowerCase()
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local")
  ) {
    throw new Error("Webhook URL must not point to a private or loopback address")
  }

  // Resolve all addresses; reject if ANY of them is private (defence against
  // multi-record DNS where one record is public and another is internal).
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error("Webhook URL hostname could not be resolved")
  }
  if (addresses.length === 0) {
    throw new Error("Webhook URL hostname could not be resolved")
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new Error("Webhook URL must not point to a private or loopback address")
    }
  }
}

/**
 * Generate a cryptographically random webhook signing secret.
 * Returns 32 random bytes encoded as a 64-character lowercase hex string.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex")
}

/**
 * Sign a serialised payload string with a shared secret using HMAC-SHA256.
 * Returns a string in the format "sha256=<hex-digest>" to match the GitHub
 * webhook signature convention expected by most consumers.
 */
export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(payload).digest("hex")
  return `sha256=${hmac}`
}

/**
 * Deliver a webhook event to the registered URL.
 *
 * Behaviour:
 *  1. Serialises the payload to JSON.
 *  2. Signs the body with the webhook secret.
 *  3. POSTs to the webhook URL with standard JobBobber headers.
 *  4. Writes a WebhookDelivery log record (success or failure).
 *  5. Updates webhook.lastFiredAt and adjusts failCount.
 *
 * Network errors are caught and treated as failed deliveries — the function
 * never throws; callers receive a typed result object instead.
 */
export async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  eventType: string,
  payload: unknown,
): Promise<{ success: boolean; statusCode: number | null }> {
  const body = JSON.stringify(payload)
  const signature = signPayload(body, webhook.secret)
  const attemptedAt = new Date()
  const start = Date.now()

  let statusCode: number | null = null
  let success = false
  let errorMessage: string | undefined

  try {
    // Re-validate at delivery time to defeat DNS rebinding: a hostname that
    // resolved to a public IP at registration may now resolve to a private one.
    await assertSafeWebhookUrl(webhook.url)
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-JobBobber-Signature": signature,
        "X-JobBobber-Event": eventType,
      },
      body,
    })
    statusCode = response.status
    success = response.ok
    if (!success) {
      errorMessage = `HTTP ${statusCode}`
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Network error"
  }

  const durationMs = Date.now() - start

  // Persist delivery attempt log
  await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType: eventType as WebhookEvent,
      payload: payload as object,
      statusCode,
      success,
      attemptedAt,
      durationMs,
      errorMessage,
    },
  })

  // Update webhook-level metadata
  await db.webhook.update({
    where: { id: webhook.id },
    data: {
      lastFiredAt: attemptedAt,
      ...(success ? { failCount: 0 } : { failCount: { increment: 1 } }),
    },
  })

  return { success, statusCode }
}
