import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    jobPosting: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn(), findMany: vi.fn() },
    agentConversation: { findMany: vi.fn(), create: vi.fn() },
    match: { create: vi.fn() },
  },
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockResolvedValue("decrypted-api-key"),
}))

vi.mock("@/server/agents/employer-agent", () => ({
  evaluateCandidate: vi.fn(),
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { evaluateCandidates } from "./evaluate-candidates"
import { evaluateCandidate } from "@/server/agents/employer-agent"
import { decrypt } from "@/lib/encryption"
import { db } from "@/lib/db"

const mockDb = db as unknown as {
  jobPosting: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
  agentConversation: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  match: { create: ReturnType<typeof vi.fn> }
}

const mockedEvaluateCandidate = vi.mocked(evaluateCandidate)
const mockedDecrypt = vi.mocked(decrypt)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockStep = {
  run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}

// The handler captured by createFunction mock
const handler = evaluateCandidates as unknown as (args: {
  event: { data: { jobPostingId: string; employerId: string } }
  step: typeof mockStep
}) => Promise<{
  status: "COMPLETED" | "FAILED"
  error?: string
  totalCandidates?: number
  matchesCreated: number
  skippedCount?: number
}>

function makeEvent(jobPostingId = "jp-1", employerId = "emp-1") {
  return { event: { data: { jobPostingId, employerId } }, step: mockStep }
}

function makePosting(overrides?: Record<string, unknown>) {
  return {
    id: "jp-1",
    status: "ACTIVE",
    title: "Engineer",
    description: "Build things",
    requiredSkills: ["TypeScript"],
    preferredSkills: ["React"],
    experienceLevel: "MID",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    locationReq: null,
    salaryMin: 80000,
    salaryMax: 120000,
    benefits: [],
    whyApply: "Great team",
    ...overrides,
  }
}

function makeEmployer(overrides?: Record<string, unknown>) {
  return {
    id: "emp-1",
    byokApiKeyEncrypted: "encrypted-key",
    byokProvider: "openai",
    ...overrides,
  }
}

function makeSeeker(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: "Alice",
    headline: "Engineer",
    skills: ["TypeScript"],
    experience: [{ title: "Dev", years: 3 }],
    education: [{ degree: "BS" }],
    location: "Remote",
    profileCompleteness: 80,
    isActive: true,
    ...overrides,
  }
}

function makeEvaluation(score: number) {
  return {
    score,
    matchSummary: `Score is ${score}`,
    strengths: ["good"],
    gaps: [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluate-candidates workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-1" })
    mockDb.match.create.mockResolvedValue({ id: "match-1" })
  })

  it("returns FAILED when posting is not found", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toBe("Posting not found or not active")
    expect(result.matchesCreated).toBe(0)
  })

  it("returns FAILED when posting is not ACTIVE", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting({ status: "DRAFT" }))

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toBe("Posting not found or not active")
  })

  it("returns FAILED when employer has no BYOK key", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer({ byokApiKeyEncrypted: null }))

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toBe("No BYOK key configured")
  })

  it("returns FAILED when employer has no BYOK provider", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer({ byokProvider: null }))

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toBe("No BYOK key configured")
  })

  it("returns COMPLETED with 0 candidates when no eligible seekers", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([])

    const result = await handler(makeEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.totalCandidates).toBe(0)
    expect(result.matchesCreated).toBe(0)
    expect(result.skippedCount).toBe(0)
  })

  it("excludes already-evaluated candidates", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([{ seekerId: "seeker-1" }])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }, { id: "seeker-2" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-2"))
    mockedEvaluateCandidate.mockResolvedValue(makeEvaluation(50))

    const result = await handler(makeEvent())

    expect(result.totalCandidates).toBe(1)
    // seeker-1 was excluded, only seeker-2 processed
    expect(mockDb.jobSeeker.findUnique).toHaveBeenCalledWith({ where: { id: "seeker-2" } })
    expect(mockDb.jobSeeker.findUnique).not.toHaveBeenCalledWith({ where: { id: "seeker-1" } })
  })

  it("creates Match + AgentConversation for scores >= 30", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-1"))
    mockedEvaluateCandidate.mockResolvedValue(makeEvaluation(50))
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-1" })

    const result = await handler(makeEvent())

    expect(result.matchesCreated).toBe(1)
    expect(mockDb.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED_MATCH",
          seekerId: "seeker-1",
          jobPostingId: "jp-1",
        }),
      }),
    )
    expect(mockDb.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv-1",
          jobPostingId: "jp-1",
          seekerId: "seeker-1",
          employerId: "emp-1",
          confidenceScore: "GOOD",
          matchSummary: "Score is 50",
        }),
      }),
    )
  })

  it("creates only AgentConversation (COMPLETED_NO_MATCH) for scores < 30", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-1"))
    mockedEvaluateCandidate.mockResolvedValue(makeEvaluation(20))

    const result = await handler(makeEvent())

    expect(result.matchesCreated).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(mockDb.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED_NO_MATCH",
          seekerId: "seeker-1",
          outcome: "Below threshold: 20",
        }),
      }),
    )
    expect(mockDb.match.create).not.toHaveBeenCalled()
  })

  it("handles evaluateCandidate returning null gracefully", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-1"))
    mockedEvaluateCandidate.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.matchesCreated).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(mockDb.agentConversation.create).not.toHaveBeenCalled()
    expect(mockDb.match.create).not.toHaveBeenCalled()
  })

  it("handles seeker not found during batch evaluation", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.skippedCount).toBe(1)
    expect(result.matchesCreated).toBe(0)
    expect(mockedEvaluateCandidate).not.toHaveBeenCalled()
  })

  it("processes multiple batches correctly", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])

    // 12 candidates = 2 batches (10 + 2)
    const candidateIds = Array.from({ length: 12 }, (_, i) => ({ id: `seeker-${i}` }))
    mockDb.jobSeeker.findMany.mockResolvedValue(candidateIds)

    mockDb.jobSeeker.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(makeSeeker(where.id)),
    )

    // Alternate: high scores and low scores
    mockedEvaluateCandidate.mockImplementation(() => {
      const callCount = mockedEvaluateCandidate.mock.calls.length
      const score = callCount % 2 === 1 ? 70 : 20
      return Promise.resolve(makeEvaluation(score))
    })

    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-auto" })

    const result = await handler(makeEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.totalCandidates).toBe(12)
    // 6 high scores (odd calls), 6 low scores (even calls)
    expect(result.matchesCreated).toBe(6)
    expect(result.skippedCount).toBe(6)

    // Verify step.run was called for 2 batches (plus fetch-context and find-candidates)
    const batchCalls = mockStep.run.mock.calls.filter(
      ([name]: [string]) => typeof name === "string" && name.startsWith("evaluate-batch-"),
    )
    expect(batchCalls).toHaveLength(2)
  })

  it("uses STRONG confidence for score >= 70", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-1"))
    mockedEvaluateCandidate.mockResolvedValue(makeEvaluation(75))
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-1" })

    await handler(makeEvent())

    expect(mockDb.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confidenceScore: "STRONG" }),
      }),
    )
  })

  it("uses POTENTIAL confidence for score = 30", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedDecrypt.mockResolvedValue("decrypted-api-key")
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "seeker-1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("seeker-1"))
    mockedEvaluateCandidate.mockResolvedValue(makeEvaluation(30))
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-1" })

    await handler(makeEvent())

    expect(mockDb.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confidenceScore: "POTENTIAL" }),
      }),
    )
  })
})
