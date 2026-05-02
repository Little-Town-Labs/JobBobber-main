import { describe, it, expect } from "vitest"
import { formatDuration } from "./format-duration"

describe("formatDuration", () => {
  it("returns '< 1 hour' for 0ms", () => {
    expect(formatDuration(0)).toBe("< 1 hour")
  })

  it("returns '< 1 hour' for sub-hour values", () => {
    expect(formatDuration(30 * 60 * 1000)).toBe("< 1 hour") // 30 minutes
    expect(formatDuration(59 * 60 * 1000)).toBe("< 1 hour") // 59 minutes
  })

  it("returns hours-only for values under 24h", () => {
    expect(formatDuration(1 * 60 * 60 * 1000)).toBe("1 hour")
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2 hours")
    expect(formatDuration(5 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe("5 hours 30 minutes")
    expect(formatDuration(23 * 60 * 60 * 1000)).toBe("23 hours")
  })

  it("returns days + hours for values >= 24h", () => {
    expect(formatDuration(3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)).toBe("3 days 4 hours")
    expect(formatDuration(1 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000)).toBe("1 day 1 hour")
  })

  it("handles exactly 24h boundary", () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe("1 day")
  })

  it("handles large values", () => {
    expect(formatDuration(30 * 24 * 60 * 60 * 1000)).toBe("30 days")
    expect(formatDuration(365 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)).toBe(
      "365 days 12 hours",
    )
  })

  it("returns null for null input", () => {
    expect(formatDuration(null)).toBeNull()
  })
})
