/**
 * Task 4.5 — CSV export utility tests (TDD RED phase).
 */
import { describe, it, expect, vi } from "vitest"

// The module doesn't exist yet — this will fail in RED phase
import { generateMatchCsv, downloadCsv } from "@/lib/csv-export"

describe("generateMatchCsv", () => {
  it("converts match objects to CSV string with headers", () => {
    const matches = [
      {
        seekerName: "Alice Smith",
        confidenceScore: "STRONG",
        employerStatus: "PENDING",
        postingTitle: "Senior Engineer",
        createdAt: "2026-01-15T00:00:00Z",
      },
      {
        seekerName: "Bob Jones",
        confidenceScore: "GOOD",
        employerStatus: "ACCEPTED",
        postingTitle: "Senior Engineer",
        createdAt: "2026-01-16T00:00:00Z",
      },
    ]

    const csv = generateMatchCsv(matches)

    const lines = csv.split("\n")
    expect(lines[0]).toBe("Name,Confidence,Status,Posting,Date")
    expect(lines[1]).toBe("Alice Smith,STRONG,PENDING,Senior Engineer,2026-01-15T00:00:00Z")
    expect(lines[2]).toBe("Bob Jones,GOOD,ACCEPTED,Senior Engineer,2026-01-16T00:00:00Z")
  })

  it("handles special characters — commas in values", () => {
    const matches = [
      {
        seekerName: "Smith, Alice",
        confidenceScore: "GOOD",
        employerStatus: "PENDING",
        postingTitle: "Engineer",
        createdAt: "2026-01-15T00:00:00Z",
      },
    ]

    const csv = generateMatchCsv(matches)
    const lines = csv.split("\n")
    // Value with comma should be quoted
    expect(lines[1]).toContain('"Smith, Alice"')
  })

  it("handles special characters — quotes in values", () => {
    const matches = [
      {
        seekerName: 'Alice "Ace" Smith',
        confidenceScore: "STRONG",
        employerStatus: "PENDING",
        postingTitle: "Engineer",
        createdAt: "2026-01-15T00:00:00Z",
      },
    ]

    const csv = generateMatchCsv(matches)
    const lines = csv.split("\n")
    // Quotes should be escaped by doubling
    expect(lines[1]).toContain('"Alice ""Ace"" Smith"')
  })

  it("handles special characters — newlines in values", () => {
    const matches = [
      {
        seekerName: "Alice\nSmith",
        confidenceScore: "GOOD",
        employerStatus: "PENDING",
        postingTitle: "Engineer",
        createdAt: "2026-01-15T00:00:00Z",
      },
    ]

    const csv = generateMatchCsv(matches)
    // Newline in value should be quoted
    expect(csv).toContain('"Alice\nSmith"')
  })

  it("includes only allowed fields — no private data (NFR-2)", () => {
    const matches = [
      {
        seekerName: "Alice",
        confidenceScore: "STRONG",
        employerStatus: "PENDING",
        postingTitle: "Engineer",
        createdAt: "2026-01-15T00:00:00Z",
        // These should NOT appear in output
        seekerContactInfo: { email: "secret@test.com" },
        salary: 150000,
        evaluationData: { private: true },
      },
    ]

    const csv = generateMatchCsv(matches as never)

    expect(csv).not.toContain("secret@test.com")
    expect(csv).not.toContain("150000")
    expect(csv).not.toContain("private")
  })

  it("returns header-only for empty input", () => {
    const csv = generateMatchCsv([])

    expect(csv).toBe("Name,Confidence,Status,Posting,Date")
  })
})

describe("downloadCsv", () => {
  it("triggers download via Blob API", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:url")
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const createElement = vi.fn().mockReturnValue({
      href: "",
      download: "",
      click,
    })

    // Mock browser APIs
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
    vi.stubGlobal("document", {
      createElement,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })

    downloadCsv("col1,col2\nval1,val2", "test-export.csv")

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:url")

    vi.unstubAllGlobals()
  })
})
