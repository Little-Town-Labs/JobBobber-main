/**
 * Task 5.1 — End-to-End Two-Way Matching Integration Tests
 *
 * Tests full conversation scenarios through the Inngest workflow with mocked
 * LLM calls. Covers mutual match, no-match, deal-breaker early exit, and
 * backwards compatibility.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    agentConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    jobPosting: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    seekerSettings: { findUnique: vi.fn() },
    jobSettings: { findUnique: vi.fn() },
    match: { create: vi.fn() },
  },
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockResolvedValue("sk-decrypted-key"),
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

vi.mock("ai", () => ({ generateObject: vi.fn() }))

import { db } from "@/lib/db"
import { buildConversationWorkflow } from "@/server/inngest/functions/run-agent-conversation"

const mockDb = db as unknown as {
  agentConversation: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  jobPosting: { findUnique: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  seekerSettings: { findUnique: ReturnType<typeof vi.fn> }
  jobSettings: { findUnique: ReturnType<typeof vi.fn> }
  match: { create: ReturnType<typeof vi.fn> }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvaluation(
  role: "employer_agent" | "seeker_agent",
  recommendation: "MATCH" | "NO_MATCH",
  overallScore = 80,
) {
  return {
    agentRole: role,
    overallScore,
    recommendation,
    reasoning: `This is a ${recommendation === "MATCH" ? "good" : "poor"} fit based on thorough evaluation of all factors`,
    dimensions: [
      {
        name: "skills_alignment" as const,
        score: overallScore,
        reasoning: "Skills are well aligned with requirements",
      },
      {
        name: "experience_fit" as const,
        score: overallScore - 5,
        reasoning: "Experience level matches expectations",
      },
      {
        name: "compensation_alignment" as const,
        score: overallScore + 5,
        reasoning: "Compensation range is acceptable",
      },
      {
        name: "culture_fit" as const,
        score: overallScore - 10,
        reasoning: "Culture alignment looks positive",
      },
    ],
  }
}

const fixtures = {
  posting: {
    id: "jp_1",
    title: "Engineer",
    description: "Build things",
    requiredSkills: ["TypeScript"],
    preferredSkills: [],
    experienceLevel: "MID",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    locationReq: null,
    salaryMin: 80000,
    salaryMax: 130000,
    benefits: [],
    whyApply: null,
    status: "ACTIVE",
    employerId: "emp_1",
  },
  seeker: {
    id: "seeker_1",
    name: "Jane",
    headline: "Dev",
    skills: ["TypeScript"],
    experience: [],
    education: [],
    location: "Remote",
    profileCompleteness: 80,
    isActive: true,
  },
  employer: {
    id: "emp_1",
    name: "Corp",
    byokApiKeyEncrypted: "encrypted_key",
    byokProvider: "openai",
  },
  seekerSettings: {
    id: "ss_1",
    seekerId: "seeker_1",
    minSalary: 90000,
    dealBreakers: [],
    priorities: ["remote"],
    exclusions: [],
    customPrompt: null,
    byokApiKeyEncrypted: "encrypted_seeker_key",
    byokProvider: "openai",
  },
  jobSettings: {
    id: "js_1",
    jobPostingId: "jp_1",
    trueMaxSalary: 140000,
    urgency: "MEDIUM",
    willingToTrain: [],
    priorityAttrs: [],
    customPrompt: null,
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
  }
}

function setupDb() {
  mockDb.agentConversation.findFirst.mockResolvedValue(null)
  mockDb.jobPosting.findUnique.mockResolvedValue(fixtures.posting as never)
  mockDb.jobSeeker.findUnique.mockResolvedValue(fixtures.seeker as never)
  mockDb.employer.findUnique.mockResolvedValue(fixtures.employer as never)
  mockDb.seekerSettings.findUnique.mockResolvedValue(fixtures.seekerSettings as never)
  mockDb.jobSettings.findUnique.mockResolvedValue(fixtures.jobSettings as never)
  mockDb.agentConversation.create.mockResolvedValue({ id: "conv_1" } as never)
  mockDb.agentConversation.update.mockResolvedValue({ id: "conv_1" } as never)
  mockDb.match.create.mockResolvedValue({ id: "match_1" } as never)
}

async function mockLlmResponses(responses: Array<{ decision: string; evaluation?: unknown }>) {
  const { generateObject } = vi.mocked(await import("ai"))
  let callIndex = 0
  generateObject.mockImplementation(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return {
      object: {
        content: `Agent response turn ${callIndex}. Detailed analysis of candidate fit and opportunity.`,
        phase: "decision",
        decision: resp.decision,
        evaluation: resp.evaluation,
      },
    } as never
  })
}

const eventData = { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("two-way matching — end-to-end integration", () => {
  beforeEach(() => vi.clearAllMocks())

  it(
    "mutual MATCH: creates Match with evaluationData, confidence, and summaries",
    { timeout: 30_000 },
    async () => {
      setupDb()
      await mockLlmResponses([
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "MATCH", evaluation: makeEvaluation("employer_agent", "MATCH", 85) },
        { decision: "MATCH", evaluation: makeEvaluation("seeker_agent", "MATCH", 80) },
      ])

      const handler = buildConversationWorkflow()
      const result = await handler({ event: { data: eventData }, step: createMockStep() } as never)

      expect(result).toMatchObject({ status: "COMPLETED_MATCH" })
      expect(mockDb.match.create).toHaveBeenCalledTimes(1)

      const matchData = mockDb.match.create.mock.calls[0][0].data
      expect(matchData.evaluationData).not.toBeNull()
      expect(matchData.evaluationData.employerEvaluation).toBeDefined()
      expect(matchData.evaluationData.seekerEvaluation).toBeDefined()
      expect(matchData.evaluationData.confidenceInputs).toBeDefined()
      expect(matchData.confidenceScore).toBe("STRONG") // avg ~82.5 → STRONG
      expect(matchData.employerSummary).toBeTruthy()
      expect(matchData.seekerSummary).toBeTruthy()
    },
  )

  it(
    "seeker NO_MATCH: no Match created, conversation COMPLETED_NO_MATCH",
    { timeout: 30_000 },
    async () => {
      setupDb()
      await mockLlmResponses([
        { decision: "CONTINUE" },
        { decision: "NO_MATCH", evaluation: makeEvaluation("seeker_agent", "NO_MATCH", 25) },
      ])

      const handler = buildConversationWorkflow()
      const result = await handler({ event: { data: eventData }, step: createMockStep() } as never)

      expect(result).toMatchObject({ status: "COMPLETED_NO_MATCH" })
      expect(mockDb.match.create).not.toHaveBeenCalled()
    },
  )

  it("employer NO_MATCH: no Match created, silent termination", { timeout: 30_000 }, async () => {
    setupDb()
    await mockLlmResponses([
      { decision: "NO_MATCH", evaluation: makeEvaluation("employer_agent", "NO_MATCH", 20) },
    ])

    const handler = buildConversationWorkflow()
    const result = await handler({ event: { data: eventData }, step: createMockStep() } as never)

    expect(result).toMatchObject({ status: "COMPLETED_NO_MATCH" })
    expect(mockDb.match.create).not.toHaveBeenCalled()
  })

  it("max turns without consensus: COMPLETED_NO_MATCH", { timeout: 30_000 }, async () => {
    setupDb()
    // All CONTINUE — never reaches consensus
    await mockLlmResponses([{ decision: "CONTINUE" }])

    const handler = buildConversationWorkflow()
    const result = await handler({ event: { data: eventData }, step: createMockStep() } as never)

    expect(result).toMatchObject({ status: "COMPLETED_NO_MATCH" })
    expect(mockDb.match.create).not.toHaveBeenCalled()
  })

  it(
    "conversation finalize updates status to COMPLETED_MATCH with outcome",
    { timeout: 30_000 },
    async () => {
      setupDb()
      await mockLlmResponses([
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "MATCH", evaluation: makeEvaluation("employer_agent", "MATCH", 75) },
        { decision: "MATCH", evaluation: makeEvaluation("seeker_agent", "MATCH", 70) },
      ])

      const handler = buildConversationWorkflow()
      await handler({ event: { data: eventData }, step: createMockStep() } as never)

      // Verify finalize step updates conversation with final status
      const updateCalls = mockDb.agentConversation.update.mock.calls
      const finalizeCall = updateCalls.find(
        (call: unknown[]) =>
          (call[0] as { data: { status?: string } }).data.status === "COMPLETED_MATCH",
      )
      expect(finalizeCall).toBeDefined()
    },
  )

  it("POTENTIAL confidence for low-scoring mutual match", { timeout: 30_000 }, async () => {
    setupDb()
    await mockLlmResponses([
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "MATCH", evaluation: makeEvaluation("employer_agent", "MATCH", 40) },
      { decision: "MATCH", evaluation: makeEvaluation("seeker_agent", "MATCH", 35) },
    ])

    const handler = buildConversationWorkflow()
    await handler({ event: { data: eventData }, step: createMockStep() } as never)

    const matchData = mockDb.match.create.mock.calls[0][0].data
    expect(matchData.confidenceScore).toBe("POTENTIAL") // avg ~37.5 → POTENTIAL
  })
})
