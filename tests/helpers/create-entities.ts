/**
 * Prisma entity factories for test scaffolding.
 *
 * Each factory returns a plain object matching the corresponding Prisma model
 * shape with sensible defaults. Pass overrides to customize specific fields.
 *
 * @see tests/helpers/create-entities.test.ts
 */

let counter = 0
function nextId() {
  counter++
  return `test-${counter}-${Date.now()}`
}

const NOW = new Date("2026-01-01T00:00:00Z")

export function createMockJobSeeker(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    clerkUserId: `clerk-user-${nextId()}`,
    name: "Test Seeker",
    headline: null,
    bio: null,
    resumeUrl: null,
    parsedResume: null,
    experience: [],
    education: [],
    skills: ["TypeScript", "React"],
    urls: [],
    profileUrls: [],
    location: null,
    relocationPreference: null,
    profileCompleteness: 0,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function createMockEmployer(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    clerkOrgId: `org-${nextId()}`,
    name: "Test Employer",
    industry: null,
    size: null,
    description: null,
    culture: null,
    headquarters: null,
    locations: [],
    websiteUrl: null,
    urls: {},
    benefits: [],
    logoUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    byokApiKeyEncrypted: null,
    byokProvider: null,
    byokKeyValidatedAt: null,
    byokMaskedKey: null,
    notifPrefs: {},
    ...overrides,
  }
}

export function createMockJobPosting(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    employerId: nextId(),
    title: "Test Job Posting",
    department: null,
    description: "A test job posting description for unit tests.",
    responsibilities: null,
    requiredSkills: ["TypeScript"],
    preferredSkills: [],
    experienceLevel: "MID" as const,
    employmentType: "FULL_TIME" as const,
    locationType: "REMOTE" as const,
    locationReq: null,
    salaryMin: null,
    salaryMax: null,
    benefits: [],
    whyApply: null,
    status: "DRAFT" as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function createMockMatch(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    conversationId: nextId(),
    jobPostingId: nextId(),
    seekerId: nextId(),
    employerId: nextId(),
    confidenceScore: "GOOD" as const,
    matchSummary: "A solid match with good alignment across key requirements.",
    seekerStatus: "PENDING" as const,
    employerStatus: "PENDING" as const,
    seekerContactInfo: null,
    seekerAvailability: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}
