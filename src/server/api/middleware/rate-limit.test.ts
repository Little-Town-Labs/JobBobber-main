/**
 * Task 4.1 — Rate limiting middleware tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

// ---------------------------------------------------------------------------
// Mock checkRateLimit
// ---------------------------------------------------------------------------

const mockCheckRateLimit = vi.hoisted(() => vi.fn())

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { enforceRateLimit, procedureToCategory } from "./rate-limit"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows requests under limit", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 95,
      reset: Date.now() + 60_000,
    })

    const result = await enforceRateLimit("user-123", "read")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(95)
    expect(mockCheckRateLimit).toHaveBeenCalledWith("user-123", "read")
  })

  it("throws TOO_MANY_REQUESTS when limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    })

    await expect(enforceRateLimit("user-123", "write")).rejects.toThrow(TRPCError)
    await expect(enforceRateLimit("user-123", "write")).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    })
  })

  it("handles fail-open when Redis unavailable", async () => {
    // checkRateLimit itself fails open, returning success: true
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 100,
      reset: 0,
    })

    const result = await enforceRateLimit("user-123", "auth")

    expect(result.success).toBe(true)
    expect(result.reset).toBe(0)
  })

  it("passes correct category to checkRateLimit", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    })

    await enforceRateLimit("ip-hash-abc", "agent")

    expect(mockCheckRateLimit).toHaveBeenCalledWith("ip-hash-abc", "agent")
  })
})

describe("procedureToCategory", () => {
  it("maps query to read", () => {
    expect(procedureToCategory("query")).toBe("read")
  })

  it("maps mutation to write", () => {
    expect(procedureToCategory("mutation")).toBe("write")
  })

  it("maps subscription to read", () => {
    expect(procedureToCategory("subscription")).toBe("read")
  })
})
