/**
 * Task 4.3 — Privacy Filter for Evaluation Reasoning Tests (TDD RED phase)
 *
 * Verifies that filterPrivateValues() correctly redacts private information
 * from evaluation reasoning text produced by agents during conversations.
 */
import { describe, it, expect } from "vitest"
import { filterPrivateValues, type PrivateValues } from "@/server/agents/privacy-filter"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REDACTED = "[REDACTED]"

function makePrivateValues(overrides: Partial<PrivateValues> = {}): PrivateValues {
  return {
    seekerMinSalary: null,
    seekerDealBreakers: [],
    employerTrueMaxSalary: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("filterPrivateValues — evaluation reasoning text", () => {
  describe("salary figures in reasoning", () => {
    it("redacts dollar-formatted salary ($120,000)", () => {
      const pv = makePrivateValues({ seekerMinSalary: 120000 })
      const reasoning = "The candidate expects at least $120,000 per year which aligns well."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("$120,000")
      expect(result).toContain(REDACTED)
    })

    it("redacts plain numeric salary (120000)", () => {
      const pv = makePrivateValues({ seekerMinSalary: 120000 })
      const reasoning = "Minimum salary requirement is 120000 annually."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("120000")
      expect(result).toContain(REDACTED)
    })

    it("redacts shorthand salary (120k, $120K)", () => {
      const pv = makePrivateValues({ seekerMinSalary: 120000 })
      const reasoning = "Expects around 120k base, or roughly $120K total comp."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("120k")
      expect(result).not.toContain("$120K")
      expect(result).toContain(REDACTED)
    })

    it("redacts employer true max salary from reasoning", () => {
      const pv = makePrivateValues({ employerTrueMaxSalary: 150000 })
      const reasoning = "Budget allows up to $150,000 but posted range is lower."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("$150,000")
      expect(result).toContain(REDACTED)
    })

    it("redacts both seeker and employer salary values", () => {
      const pv = makePrivateValues({
        seekerMinSalary: 120000,
        employerTrueMaxSalary: 150000,
      })
      const reasoning =
        "Seeker wants $120,000 minimum. Employer can go up to $150,000. Good overlap."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("$120,000")
      expect(result).not.toContain("$150,000")
    })
  })

  describe("deal-breaker text in reasoning", () => {
    it("redacts deal-breaker phrase (case-insensitive)", () => {
      const pv = makePrivateValues({ seekerDealBreakers: ["no onsite"] })
      const reasoning = "Candidate has No Onsite requirement which conflicts with hybrid policy."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toMatch(/no onsite/i)
      expect(result).toContain(REDACTED)
    })

    it("redacts multiple deal-breakers", () => {
      const pv = makePrivateValues({
        seekerDealBreakers: ["no onsite", "no travel"],
      })
      const reasoning =
        "The seeker has firm constraints: no onsite work and no travel requirements."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toMatch(/no onsite/i)
      expect(result).not.toMatch(/no travel/i)
    })

    it("handles deal-breakers with special regex characters", () => {
      const pv = makePrivateValues({
        seekerDealBreakers: ["C++ only"],
      })
      const reasoning = "Candidate insists on C++ only environments."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("C++ only")
      expect(result).toContain(REDACTED)
    })
  })

  describe("exclusion company names in reasoning", () => {
    it("redacts exclusion company names from evaluation reasoning", () => {
      const pv = makePrivateValues({
        seekerDealBreakers: ["Meta", "Amazon"],
      })
      const reasoning =
        "Candidate excluded Meta and Amazon from consideration due to cultural concerns."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("Meta")
      expect(result).not.toContain("Amazon")
      expect(result).toContain(REDACTED)
    })
  })

  describe("combined filtering on realistic evaluation text", () => {
    it("redacts all private values from a full evaluation reasoning paragraph", () => {
      const pv = makePrivateValues({
        seekerMinSalary: 130000,
        employerTrueMaxSalary: 160000,
        seekerDealBreakers: ["no relocation", "Google"],
      })
      const reasoning = [
        "Skills alignment is strong at 85/100.",
        "Compensation: seeker wants $130,000 minimum, employer budget goes to $160,000.",
        "Work arrangement is compatible except the seeker has a no relocation requirement.",
        "The seeker excluded Google from their search which is not relevant here.",
      ].join(" ")

      const result = filterPrivateValues(reasoning, pv)

      expect(result).not.toContain("$130,000")
      expect(result).not.toContain("$160,000")
      expect(result).not.toMatch(/no relocation/i)
      expect(result).not.toContain("Google")
      // Legitimate content should remain
      expect(result).toContain("Skills alignment is strong at 85/100")
      expect(result).toContain("Compensation")
    })

    it("leaves text unchanged when no private values match", () => {
      const pv = makePrivateValues({
        seekerMinSalary: 100000,
        seekerDealBreakers: ["no onsite"],
      })
      const reasoning = "Great culture fit. Remote-friendly team. Salary within posted range."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).toBe(reasoning)
    })

    it("handles null salary values gracefully", () => {
      const pv = makePrivateValues({
        seekerMinSalary: null,
        employerTrueMaxSalary: null,
        seekerDealBreakers: [],
      })
      const reasoning = "Standard evaluation with no private parameters to redact."

      const result = filterPrivateValues(reasoning, pv)

      expect(result).toBe(reasoning)
    })
  })
})
