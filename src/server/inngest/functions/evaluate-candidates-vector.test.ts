import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    jobPosting: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn(), findMany: vi.fn() },
    agentConversation: { findMany: vi.fn(), create: vi.fn() },
    match: { create: vi.fn() },
    $queryRaw: vi.fn(),
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

vi.mock("@/lib/flags", () => ({
  AGENT_CONVERSATIONS: vi.fn().mockResolvedValue(true),
  VECTOR_SEARCH: vi.fn().mockResolvedValue(false),
}))

vi.mock("@/lib/embeddings", () => ({
  findSimilarCandidates: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { evaluateCandidates } from "./evaluate-candidates"
import { evaluateCandidate } from "@/server/agents/employer-agent"
import { db } from "@/lib/db"
import { VECTOR_SEARCH } from "@/lib/flags"
import { findSimilarCandidates } from "@/lib/embeddings"

const mockDb = db as unknown as {
  jobPosting: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
  agentConversation: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  match: { create: ReturnType<typeof vi.fn> }
  $queryRaw: ReturnType<typeof vi.fn>
}

const mockedVectorSearch = vi.mocked(VECTOR_SEARCH)
const mockedFindSimilar = vi.mocked(findSimilarCandidates)
const mockedEvaluateCandidate = vi.mocked(evaluateCandidate)

const mockStep = {
  run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  sendEvent: vi.fn(),
}

const handler = evaluateCandidates as unknown as (args: {
  event: { data: { jobPostingId: string; employerId: string } }
  step: typeof mockStep
}) => Promise<Record<string, unknown>>

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

function makeSeeker(id: string) {
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
  }
}

// ---------------------------------------------------------------------------
// Vector search integration tests
// ---------------------------------------------------------------------------

describe("evaluate-candidates with vector search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv-1" })
    mockDb.match.create.mockResolvedValue({ id: "match-1" })
  })

  it("uses findSimilarCandidates when VECTOR_SEARCH flag is on and posting has embedding", async () => {
    mockedVectorSearch.mockResolvedValue(true)
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())

    // Simulate posting has embedding via $queryRaw
    mockDb.$queryRaw.mockResolvedValue([{ job_embedding: [0.5] }])

    mockedFindSimilar.mockResolvedValue([
      { seekerId: "s1", similarity: 0.9 },
      { seekerId: "s2", similarity: 0.7 },
    ])

    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }])
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(makeSeeker(where.id)),
    )
    mockedEvaluateCandidate.mockResolvedValue({
      score: 50,
      matchSummary: "Good match",
      strengthAreas: ["skills"],
      gapAreas: [],
    } as never)

    const result = await handler(makeEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.searchMode).toBe("vector")
    expect(mockedFindSimilar).toHaveBeenCalled()
  })

  it("falls back to all candidates when posting has no embedding", async () => {
    mockedVectorSearch.mockResolvedValue(true)
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())

    // No embedding
    mockDb.$queryRaw.mockResolvedValue([{ job_embedding: null }])

    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([])

    const result = await handler(makeEvent())

    expect(result.searchMode).toBe("fallback")
    expect(mockedFindSimilar).not.toHaveBeenCalled()
  })

  it("falls back when VECTOR_SEARCH flag is off", async () => {
    mockedVectorSearch.mockResolvedValue(false)
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([])

    const result = await handler(makeEvent())

    expect(result.searchMode).toBe("fallback")
    expect(mockedFindSimilar).not.toHaveBeenCalled()
  })

  it("includes shortlistSize in result when using vector search", async () => {
    mockedVectorSearch.mockResolvedValue(true)
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockDb.$queryRaw.mockResolvedValue([{ job_embedding: [0.5] }])
    mockedFindSimilar.mockResolvedValue([{ seekerId: "s1", similarity: 0.9 }])
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.jobSeeker.findMany.mockResolvedValue([{ id: "s1" }])
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker("s1"))
    mockedEvaluateCandidate.mockResolvedValue({
      score: 50,
      matchSummary: "Good",
      strengthAreas: ["skills"],
      gapAreas: [],
    } as never)

    const result = await handler(makeEvent())

    expect(result.shortlistSize).toBe(1)
  })
})
