/**
 * T3.3 — tRPC health endpoint E2E smoke test.
 *
 * Hits /api/trpc/health.ping on the running dev server and confirms
 * the response matches the HealthPingOutput contract.
 *
 * Requires the dev server to be running (playwright.config.ts starts it automatically).
 */
import { test, expect } from "@playwright/test"

test.describe("Health endpoint", () => {
  test("health.ping returns { status: 'ok', timestamp: string }", async ({ request }) => {
    const response = await request.get("/api/trpc/health.ping")

    expect(response.ok()).toBe(true)
    expect(response.status()).toBe(200)

    const body = (await response.json()) as {
      result?: { data?: { status?: string; timestamp?: string } }
    }

    // tRPC wraps responses in { result: { data: ... } }
    const data = body.result?.data
    expect(data?.status).toBe("ok")
    expect(typeof data?.timestamp).toBe("string")
  })

  test("health.deepCheck returns healthy status", async ({ request }) => {
    const response = await request.get("/api/trpc/health.deepCheck")

    expect(response.ok()).toBe(true)

    const body = (await response.json()) as {
      result?: {
        data?: {
          healthy?: boolean
          checks?: Array<{ name: string; status: string; latencyMs: number }>
          timestamp?: string
        }
      }
    }

    const data = body.result?.data
    expect(typeof data?.healthy).toBe("boolean")
    expect(Array.isArray(data?.checks)).toBe(true)
    expect(typeof data?.timestamp).toBe("string")
  })
})
