import { describe, it, expect } from "vitest"
import { generateMetricsCsv } from "./csv-generator"

interface PostingMetric {
  title: string
  status: string
  createdAt: Date
  firstMatchAt: Date | null
  firstMutualAcceptAt: Date | null
  timeToFirstMatchMs: number | null
  timeToMutualAcceptMs: number | null
  totalMatches: number
  totalAccepts: number
}

const BASE_POSTING: PostingMetric = {
  title: "Software Engineer",
  status: "ACTIVE",
  createdAt: new Date("2026-01-15"),
  firstMatchAt: new Date("2026-01-16"),
  firstMutualAcceptAt: new Date("2026-01-20"),
  timeToFirstMatchMs: 24 * 60 * 60 * 1000, // 24 hours
  timeToMutualAcceptMs: 5 * 24 * 60 * 60 * 1000, // 5 days
  totalMatches: 10,
  totalAccepts: 3,
}

describe("generateMetricsCsv", () => {
  it("returns header row for empty array", () => {
    const csv = generateMetricsCsv([])
    const lines = csv.split("\n")
    expect(lines[0]).toBe(
      "Title,Status,Created,First Match Date,First Mutual Accept Date,Time to First Match (hours),Time to Mutual Accept (hours),Total Matches,Total Accepts",
    )
    expect(lines.length).toBe(2) // header + trailing newline
  })

  it("generates correct row for single posting", () => {
    const csv = generateMetricsCsv([BASE_POSTING])
    const lines = csv.split("\n")
    expect(lines.length).toBe(3) // header + 1 data row + trailing newline
    const row = lines[1]!
    expect(row).toContain("Software Engineer")
    expect(row).toContain("ACTIVE")
    expect(row).toContain("24.0") // 24 hours
    expect(row).toContain("120.0") // 5 days = 120 hours
    expect(row).toContain("10")
    expect(row).toContain("3")
  })

  it("escapes commas and quotes in title (RFC 4180)", () => {
    const posting = {
      ...BASE_POSTING,
      title: 'Senior "Dev", Engineer',
    }
    const csv = generateMetricsCsv([posting])
    const lines = csv.split("\n")
    // RFC 4180: field with commas/quotes is quoted, internal quotes doubled
    expect(lines[1]).toContain('"Senior ""Dev"", Engineer"')
  })

  it("handles null metric values", () => {
    const posting = {
      ...BASE_POSTING,
      firstMatchAt: null,
      firstMutualAcceptAt: null,
      timeToFirstMatchMs: null,
      timeToMutualAcceptMs: null,
      totalMatches: 0,
      totalAccepts: 0,
    }
    const csv = generateMetricsCsv([posting])
    const lines = csv.split("\n")
    const row = lines[1]!
    // Null dates and times should be empty fields
    expect(row).toContain(",,,,0,0")
  })

  it("converts milliseconds to hours in CSV output", () => {
    const posting = {
      ...BASE_POSTING,
      timeToFirstMatchMs: 90 * 60 * 1000, // 1.5 hours
      timeToMutualAcceptMs: 48 * 60 * 60 * 1000, // 48 hours
    }
    const csv = generateMetricsCsv([posting])
    const lines = csv.split("\n")
    expect(lines[1]).toContain("1.5")
    expect(lines[1]).toContain("48.0")
  })
})
