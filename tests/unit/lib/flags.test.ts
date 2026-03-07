/**
 * T5.1T — Feature flags tests
 *
 * Confirms all platform feature flags default to false and assertFlagEnabled
 * throws NOT_FOUND when a flag is disabled.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// @vercel/flags/next is mocked globally in tests/setup.ts

describe("feature flags — default values", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("SEEKER_PROFILE defaults to false", async () => {
    const { SEEKER_PROFILE } = await import("@/lib/flags")
    expect(await SEEKER_PROFILE()).toBe(false)
  })

  it("EMPLOYER_PROFILE defaults to false", async () => {
    const { EMPLOYER_PROFILE } = await import("@/lib/flags")
    expect(await EMPLOYER_PROFILE()).toBe(false)
  })

  it("AI_MATCHING defaults to false", async () => {
    const { AI_MATCHING } = await import("@/lib/flags")
    expect(await AI_MATCHING()).toBe(false)
  })

  it("MATCH_DASHBOARD defaults to false", async () => {
    const { MATCH_DASHBOARD } = await import("@/lib/flags")
    expect(await MATCH_DASHBOARD()).toBe(false)
  })

  it("FEEDBACK_INSIGHTS defaults to false", async () => {
    const { FEEDBACK_INSIGHTS } = await import("@/lib/flags")
    expect(await FEEDBACK_INSIGHTS()).toBe(false)
  })

  it("PRIVATE_PARAMS defaults to false", async () => {
    const { PRIVATE_PARAMS } = await import("@/lib/flags")
    expect(await PRIVATE_PARAMS()).toBe(false)
  })
})

describe("assertFlagEnabled", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("throws TRPCError NOT_FOUND when the flag is false", async () => {
    const { SEEKER_PROFILE, assertFlagEnabled } = await import("@/lib/flags")
    await expect(assertFlagEnabled(SEEKER_PROFILE)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })
})
