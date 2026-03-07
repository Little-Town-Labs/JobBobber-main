/**
 * Task 1.2 — Privacy filter tests (TDD RED phase)
 */
import { describe, it, expect } from "vitest"
import { filterPrivateValues, type PrivateValues } from "./privacy-filter"

const basePrivateValues: PrivateValues = {
  seekerMinSalary: 85000,
  seekerDealBreakers: ["no remote work", "relocation required"],
  employerTrueMaxSalary: 120000,
}

describe("filterPrivateValues", () => {
  it("redacts exact salary number from text", () => {
    const result = filterPrivateValues("The candidate expects 85000 per year.", basePrivateValues)
    expect(result).not.toContain("85000")
    expect(result).toContain("[REDACTED]")
  })

  it("redacts currency-formatted salary ($85,000)", () => {
    const result = filterPrivateValues(
      "The salary expectation is $85,000 annually.",
      basePrivateValues,
    )
    expect(result).not.toContain("85,000")
    expect(result).not.toContain("85000")
  })

  it("redacts employer true max salary", () => {
    const result = filterPrivateValues("We can go up to 120000 for this role.", basePrivateValues)
    expect(result).not.toContain("120000")
  })

  it("redacts employer salary with currency formatting ($120,000)", () => {
    const result = filterPrivateValues("Budget is $120,000.", basePrivateValues)
    expect(result).not.toContain("120,000")
  })

  it("redacts deal-breaker strings when they appear verbatim", () => {
    const result = filterPrivateValues(
      "The candidate insists on no remote work and this is a concern.",
      basePrivateValues,
    )
    expect(result).not.toContain("no remote work")
    expect(result).toContain("[REDACTED]")
  })

  it("preserves non-matching numbers", () => {
    const result = filterPrivateValues(
      "The team has 15 members and 3 open roles.",
      basePrivateValues,
    )
    expect(result).toContain("15")
    expect(result).toContain("3")
  })

  it("preserves text with no private values", () => {
    const input = "The candidate has strong TypeScript skills and 5 years of experience."
    const result = filterPrivateValues(input, basePrivateValues)
    expect(result).toBe(input)
  })

  it("handles null salary values gracefully", () => {
    const result = filterPrivateValues("Some text with 50000.", {
      seekerMinSalary: null,
      seekerDealBreakers: [],
      employerTrueMaxSalary: null,
    })
    expect(result).toContain("50000")
  })

  it("handles empty deal-breakers array", () => {
    const result = filterPrivateValues("Any text here.", {
      seekerMinSalary: 85000,
      seekerDealBreakers: [],
      employerTrueMaxSalary: null,
    })
    expect(result).toBe("Any text here.")
  })

  it("redacts multiple occurrences in same text", () => {
    const result = filterPrivateValues(
      "Salary range 85000 to 120000 is discussed. Minimum is 85000.",
      basePrivateValues,
    )
    expect(result).not.toContain("85000")
    expect(result).not.toContain("120000")
  })

  it("is case-insensitive for deal-breaker matching", () => {
    const result = filterPrivateValues(
      "There is No Remote Work available for this position.",
      basePrivateValues,
    )
    expect(result.toLowerCase()).not.toContain("no remote work")
  })
})
