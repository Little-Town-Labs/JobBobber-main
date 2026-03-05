/**
 * Task 1.1 — Employer mapper + status helper unit tests
 *
 * Tests for:
 *   toFullEmployer, toPublicEmployer, toFullJobPosting, toPublicJobPosting
 *   canTransition, canActivate
 */
import { describe, it, expect } from "vitest"
import { toFullEmployer, toPublicEmployer } from "./employer-mapper"
import { toFullJobPosting, toPublicJobPosting } from "./employer-mapper"
import { canTransition, canActivate } from "@/lib/job-posting-status"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYER_ROW = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: "Fast-paced and collaborative",
  headquarters: "San Francisco, CA",
  locations: ["San Francisco", "New York"],
  websiteUrl: "https://acme.com",
  urls: { linkedin: "https://linkedin.com/company/acme" },
  benefits: ["Health Insurance", "401k"],
  logoUrl: "https://blob.vercel-storage.com/logos/acme.png",
  byokApiKeyEncrypted: "encrypted_key_abc",
  byokProvider: "openai",
  byokKeyValidatedAt: new Date("2025-06-01"),
  byokMaskedKey: "sk-...xxxx",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const POSTING_ROW = {
  id: "post_01",
  employerId: "emp_01",
  title: "Senior Engineer",
  department: "Engineering",
  description: "Build cool stuff",
  responsibilities: "Lead the team",
  requiredSkills: ["TypeScript", "React"],
  preferredSkills: ["GraphQL"],
  experienceLevel: "SENIOR" as const,
  employmentType: "FULL_TIME" as const,
  locationType: "REMOTE" as const,
  locationReq: null,
  salaryMin: 120000,
  salaryMax: 180000,
  benefits: ["RSUs"],
  whyApply: "Great team",
  status: "DRAFT" as const,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

// ---------------------------------------------------------------------------
// toFullEmployer
// ---------------------------------------------------------------------------

describe("toFullEmployer", () => {
  it("maps all public fields from a Prisma employer row", () => {
    const result = toFullEmployer(EMPLOYER_ROW)
    expect(result).toEqual({
      id: "emp_01",
      name: "Acme Corp",
      description: "We build things",
      industry: "Technology",
      size: "51-200",
      culture: "Fast-paced and collaborative",
      headquarters: "San Francisco, CA",
      locations: ["San Francisco", "New York"],
      websiteUrl: "https://acme.com",
      urls: { linkedin: "https://linkedin.com/company/acme" },
      benefits: ["Health Insurance", "401k"],
      logoUrl: "https://blob.vercel-storage.com/logos/acme.png",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-06-01T00:00:00.000Z",
    })
  })

  it("never includes BYOK fields", () => {
    const result = toFullEmployer(EMPLOYER_ROW)
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
    expect(result).not.toHaveProperty("byokKeyValidatedAt")
    expect(result).not.toHaveProperty("byokMaskedKey")
    expect(result).not.toHaveProperty("clerkOrgId")
  })
})

// ---------------------------------------------------------------------------
// toPublicEmployer
// ---------------------------------------------------------------------------

describe("toPublicEmployer", () => {
  it("omits createdAt from the output", () => {
    const result = toPublicEmployer(EMPLOYER_ROW)
    expect(result).not.toHaveProperty("createdAt")
    expect(result).toHaveProperty("updatedAt")
  })

  it("never includes BYOK fields", () => {
    const result = toPublicEmployer(EMPLOYER_ROW)
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
    expect(result).not.toHaveProperty("byokKeyValidatedAt")
    expect(result).not.toHaveProperty("byokMaskedKey")
    expect(result).not.toHaveProperty("clerkOrgId")
  })
})

// ---------------------------------------------------------------------------
// toFullJobPosting
// ---------------------------------------------------------------------------

describe("toFullJobPosting", () => {
  it("maps all posting fields", () => {
    const result = toFullJobPosting(POSTING_ROW)
    expect(result).toEqual({
      id: "post_01",
      employerId: "emp_01",
      title: "Senior Engineer",
      department: "Engineering",
      description: "Build cool stuff",
      responsibilities: "Lead the team",
      requiredSkills: ["TypeScript", "React"],
      preferredSkills: ["GraphQL"],
      experienceLevel: "SENIOR",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      locationReq: null,
      salaryMin: 120000,
      salaryMax: 180000,
      benefits: ["RSUs"],
      whyApply: "Great team",
      status: "DRAFT",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-06-01T00:00:00.000Z",
    })
  })
})

// ---------------------------------------------------------------------------
// toPublicJobPosting
// ---------------------------------------------------------------------------

describe("toPublicJobPosting", () => {
  it("omits createdAt from the output", () => {
    const result = toPublicJobPosting(POSTING_ROW)
    expect(result).not.toHaveProperty("createdAt")
    expect(result).toHaveProperty("updatedAt")
    expect(result).toHaveProperty("title")
  })
})

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

describe("canTransition", () => {
  it("allows DRAFT → ACTIVE", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(true)
  })

  it("allows ACTIVE → PAUSED", () => {
    expect(canTransition("ACTIVE", "PAUSED")).toBe(true)
  })

  it("allows ACTIVE → CLOSED", () => {
    expect(canTransition("ACTIVE", "CLOSED")).toBe(true)
  })

  it("allows ACTIVE → FILLED", () => {
    expect(canTransition("ACTIVE", "FILLED")).toBe(true)
  })

  it("allows PAUSED → ACTIVE (reactivate)", () => {
    expect(canTransition("PAUSED", "ACTIVE")).toBe(true)
  })

  it("allows PAUSED → CLOSED", () => {
    expect(canTransition("PAUSED", "CLOSED")).toBe(true)
  })

  it("allows PAUSED → FILLED", () => {
    expect(canTransition("PAUSED", "FILLED")).toBe(true)
  })

  it("rejects CLOSED → anything (terminal)", () => {
    expect(canTransition("CLOSED", "ACTIVE")).toBe(false)
    expect(canTransition("CLOSED", "PAUSED")).toBe(false)
    expect(canTransition("CLOSED", "DRAFT")).toBe(false)
    expect(canTransition("CLOSED", "FILLED")).toBe(false)
  })

  it("rejects FILLED → anything (terminal)", () => {
    expect(canTransition("FILLED", "ACTIVE")).toBe(false)
    expect(canTransition("FILLED", "PAUSED")).toBe(false)
    expect(canTransition("FILLED", "DRAFT")).toBe(false)
    expect(canTransition("FILLED", "CLOSED")).toBe(false)
  })

  it("rejects DRAFT → PAUSED (must activate first)", () => {
    expect(canTransition("DRAFT", "PAUSED")).toBe(false)
  })

  it("rejects DRAFT → CLOSED", () => {
    expect(canTransition("DRAFT", "CLOSED")).toBe(false)
  })

  it("rejects ACTIVE → DRAFT (no going back)", () => {
    expect(canTransition("ACTIVE", "DRAFT")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canActivate
// ---------------------------------------------------------------------------

describe("canActivate", () => {
  it("returns true when title, description, and requiredSkills are present", () => {
    expect(
      canActivate({
        title: "Engineer",
        description: "Build things",
        requiredSkills: ["TypeScript"],
      }),
    ).toBe(true)
  })

  it("returns false when title is empty", () => {
    expect(
      canActivate({
        title: "",
        description: "Build things",
        requiredSkills: ["TypeScript"],
      }),
    ).toBe(false)
  })

  it("returns false when description is empty", () => {
    expect(
      canActivate({
        title: "Engineer",
        description: "",
        requiredSkills: ["TypeScript"],
      }),
    ).toBe(false)
  })

  it("returns false when requiredSkills is empty", () => {
    expect(
      canActivate({
        title: "Engineer",
        description: "Build things",
        requiredSkills: [],
      }),
    ).toBe(false)
  })
})
