/**
 * Task 3.1 — run-agent-conversation Inngest workflow tests (TDD RED phase)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
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
    webhook: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/webhooks", () => ({
  deliverWebhook: vi.fn().mockResolvedValue({ success: true, statusCode: 200 }),
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn(),
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

vi.mock("ai", () => ({ generateObject: vi.fn() }))

import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { deliverWebhook } from "@/lib/webhooks"
import { buildConversationWorkflow } from "./run-agent-conversation"

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
  webhook: { findMany: ReturnType<typeof vi.fn> }
}
const mockDeliverWebhook = vi.mocked(deliverWebhook)
const mockDecrypt = vi.mocked(decrypt)

// Mock step runner
function createMockStep() {
  const results: Map<string, unknown> = new Map()
  return {
    run: vi.fn(async (name: string, fn: () => Promise<unknown>) => {
      const result = await fn()
      results.set(name, result)
      return result
    }),
    sendEvent: vi.fn(),
    results,
  }
}

// Fixtures
const mockPosting = {
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
}

const mockSeeker = {
  id: "seeker_1",
  name: "Jane",
  headline: "Dev",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  location: "Remote",
  profileCompleteness: 80,
  isActive: true,
}

const mockEmployer = {
  id: "emp_1",
  name: "Corp",
  byokApiKeyEncrypted: "encrypted_key",
  byokProvider: "openai",
}

const mockSeekerSettings = {
  id: "ss_1",
  seekerId: "seeker_1",
  minSalary: 90000,
  salaryRules: {},
  dealBreakers: [],
  priorities: ["remote"],
  exclusions: [],
  customPrompt: null,
  byokApiKeyEncrypted: "encrypted_seeker_key",
  byokProvider: "openai",
}

const mockJobSettings = {
  id: "js_1",
  jobPostingId: "jp_1",
  trueMaxSalary: 140000,
  urgency: "MEDIUM",
  willingToTrain: [],
  priorityAttrs: [],
  customPrompt: null,
}

describe("buildConversationWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMocks() {
    mockDb.agentConversation.findFirst.mockResolvedValue(null) // no duplicate
    mockDb.jobPosting.findUnique.mockResolvedValue(mockPosting as never)
    mockDb.jobSeeker.findUnique.mockResolvedValue(mockSeeker as never)
    mockDb.employer.findUnique.mockResolvedValue(mockEmployer as never)
    mockDb.seekerSettings.findUnique.mockResolvedValue(mockSeekerSettings as never)
    mockDb.jobSettings.findUnique.mockResolvedValue(mockJobSettings as never)
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.agentConversation.update.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.match.create.mockResolvedValue({ id: "match_1" } as never)
    mockDb.webhook.findMany.mockResolvedValue([])
    mockDecrypt.mockResolvedValue("sk-decrypted-key")
  }

  it("skips if an IN_PROGRESS conversation already exists for seeker+posting", async () => {
    mockDb.agentConversation.findFirst.mockResolvedValue({ id: "existing" } as never)

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    const result = await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(result).toMatchObject({ status: "SKIPPED" })
    expect(mockDb.agentConversation.create).not.toHaveBeenCalled()
  })

  it("returns SKIPPED when seeker has no BYOK key", async () => {
    setupMocks()
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      ...mockSeekerSettings,
      byokApiKeyEncrypted: null,
      byokProvider: null,
    } as never)

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    const result = await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(result).toMatchObject({ status: "SKIPPED" })
  })

  it("returns SKIPPED when employer has no BYOK key", async () => {
    setupMocks()
    mockDb.employer.findUnique.mockResolvedValue({
      ...mockEmployer,
      byokApiKeyEncrypted: null,
      byokProvider: null,
    } as never)

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    const result = await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(result).toMatchObject({ status: "SKIPPED" })
  })

  it("creates AgentConversation record with IN_PROGRESS status", { timeout: 15_000 }, async () => {
    setupMocks()

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(mockDb.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobPostingId: "jp_1",
          seekerId: "seeker_1",
          status: "IN_PROGRESS",
        }),
      }),
    )
  })

  it("does not store decrypted API keys in step results", async () => {
    setupMocks()

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    // The load-context step should return key refs, not decrypted keys
    const contextResult = step.results.get("load-context") as Record<string, unknown>
    expect(contextResult).not.toHaveProperty("employerApiKey")
    expect(contextResult).not.toHaveProperty("seekerApiKey")
    expect(contextResult).toHaveProperty("employerKeyRef")
    expect(contextResult).toHaveProperty("seekerKeyRef")
  })

  it("updates conversation status on completion", async () => {
    setupMocks()

    const step = createMockStep()
    const handler = buildConversationWorkflow()

    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(mockDb.agentConversation.update).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Task 3.1 — Match Creation with Evaluations
// ---------------------------------------------------------------------------

describe("match creation with evaluations (Task 3.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper: build a valid agent evaluation
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

  // Helper: mock generateObject to return specific agent outputs per turn
  async function mockAgentResponses(responses: Array<{ decision: string; evaluation?: unknown }>) {
    const { generateObject } = vi.mocked(await import("ai"))
    let callIndex = 0
    generateObject.mockImplementation(async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1]!
      callIndex++
      return {
        object: {
          content: `Agent response for turn ${callIndex}. This is a detailed analysis of the candidate.`,
          phase: "decision",
          decision: resp!.decision,
          evaluation: resp!.evaluation,
        },
      } as never
    })
  }

  function setupFullMocks() {
    mockDb.agentConversation.findFirst.mockResolvedValue(null)
    mockDb.jobPosting.findUnique.mockResolvedValue(mockPosting as never)
    mockDb.jobSeeker.findUnique.mockResolvedValue(mockSeeker as never)
    mockDb.employer.findUnique.mockResolvedValue(mockEmployer as never)
    mockDb.seekerSettings.findUnique.mockResolvedValue(mockSeekerSettings as never)
    mockDb.jobSettings.findUnique.mockResolvedValue(mockJobSettings as never)
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.agentConversation.update.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.match.create.mockResolvedValue({ id: "match_1" } as never)
    vi.mocked(decrypt).mockResolvedValue("sk-decrypted-key")
  }

  it(
    "creates Match with evaluationData when both agents signal MATCH",
    { timeout: 30_000 },
    async () => {
      setupFullMocks()
      const empEval = makeEvaluation("employer_agent", "MATCH", 85)
      const seekEval = makeEvaluation("seeker_agent", "MATCH", 78)

      await mockAgentResponses([
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "MATCH", evaluation: empEval },
        { decision: "MATCH", evaluation: seekEval },
      ])

      const step = createMockStep()
      const handler = buildConversationWorkflow()
      await handler({
        event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
        step,
      } as never)

      expect(mockDb.match.create).toHaveBeenCalledTimes(1)
      const matchData = mockDb.match.create.mock.calls[0]![0].data
      expect(matchData.evaluationData).not.toBeNull()
      expect(matchData.evaluationData).toHaveProperty("employerEvaluation")
      expect(matchData.evaluationData).toHaveProperty("seekerEvaluation")
      expect(matchData.evaluationData).toHaveProperty("confidenceInputs")
    },
  )

  it(
    "derives confidenceScore from dimension averages, not message count",
    { timeout: 30_000 },
    async () => {
      setupFullMocks()
      // High scores → STRONG confidence
      const empEval = makeEvaluation("employer_agent", "MATCH", 90)
      const seekEval = makeEvaluation("seeker_agent", "MATCH", 85)

      await mockAgentResponses([
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "MATCH", evaluation: empEval },
        { decision: "MATCH", evaluation: seekEval },
      ])

      const step = createMockStep()
      const handler = buildConversationWorkflow()
      await handler({
        event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
        step,
      } as never)

      const matchData = mockDb.match.create.mock.calls[0]![0].data
      // Average of scores ~87.5 → STRONG (≥75)
      expect(matchData.confidenceScore).toBe("STRONG")
    },
  )

  it(
    "extracts employerSummary and seekerSummary from evaluation reasoning",
    { timeout: 30_000 },
    async () => {
      setupFullMocks()
      const empEval = makeEvaluation("employer_agent", "MATCH", 80)
      const seekEval = makeEvaluation("seeker_agent", "MATCH", 75)

      await mockAgentResponses([
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "CONTINUE" },
        { decision: "MATCH", evaluation: empEval },
        { decision: "MATCH", evaluation: seekEval },
      ])

      const step = createMockStep()
      const handler = buildConversationWorkflow()
      await handler({
        event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
        step,
      } as never)

      const matchData = mockDb.match.create.mock.calls[0]![0].data
      expect(matchData.employerSummary).toContain("good fit")
      expect(matchData.seekerSummary).toContain("good fit")
    },
  )

  it("does NOT create Match when either agent signals NO_MATCH", { timeout: 30_000 }, async () => {
    setupFullMocks()
    const empEval = makeEvaluation("employer_agent", "NO_MATCH", 30)

    await mockAgentResponses([
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "NO_MATCH", evaluation: empEval },
    ])

    const step = createMockStep()
    const handler = buildConversationWorkflow()
    const result = await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(mockDb.match.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: "COMPLETED_NO_MATCH" })
  })

  it("populates GOOD confidence for moderate dimension scores", { timeout: 30_000 }, async () => {
    setupFullMocks()
    // Moderate scores → GOOD confidence (≥55 but <75)
    const empEval = makeEvaluation("employer_agent", "MATCH", 60)
    const seekEval = makeEvaluation("seeker_agent", "MATCH", 58)

    await mockAgentResponses([
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "CONTINUE" },
      { decision: "MATCH", evaluation: empEval },
      { decision: "MATCH", evaluation: seekEval },
    ])

    const step = createMockStep()
    const handler = buildConversationWorkflow()
    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    const matchData = mockDb.match.create.mock.calls[0]![0].data
    expect(matchData.confidenceScore).toBe("GOOD")
  })
})

// ---------------------------------------------------------------------------
// Tests: webhook delivery — conversation.completed
// ---------------------------------------------------------------------------

describe("run-agent-conversation: webhook delivery for CONVERSATION_COMPLETED", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMocksWithWebhooks() {
    mockDb.agentConversation.findFirst.mockResolvedValue(null)
    mockDb.jobPosting.findUnique.mockResolvedValue(mockPosting as never)
    mockDb.jobSeeker.findUnique.mockResolvedValue(mockSeeker as never)
    mockDb.employer.findUnique.mockResolvedValue(mockEmployer as never)
    mockDb.seekerSettings.findUnique.mockResolvedValue(mockSeekerSettings as never)
    mockDb.jobSettings.findUnique.mockResolvedValue(mockJobSettings as never)
    mockDb.agentConversation.create.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.agentConversation.update.mockResolvedValue({ id: "conv_1" } as never)
    mockDb.match.create.mockResolvedValue({ id: "match_1" } as never)
    mockDecrypt.mockResolvedValue("sk-decrypted-key")
  }

  it("fires CONVERSATION_COMPLETED webhooks to both seeker and employer", async () => {
    const seekerWebhook = { id: "wh-s", url: "https://seeker.example.com/hook", secret: "s1" }
    const employerWebhook = { id: "wh-e", url: "https://emp.example.com/hook", secret: "e1" }
    setupMocksWithWebhooks()
    // First findMany call → seeker webhooks, second → employer webhooks
    mockDb.webhook.findMany
      .mockResolvedValueOnce([seekerWebhook])
      .mockResolvedValueOnce([employerWebhook])

    const step = createMockStep()
    const handler = buildConversationWorkflow()
    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(mockDeliverWebhook).toHaveBeenCalledWith(
      seekerWebhook,
      "CONVERSATION_COMPLETED",
      expect.objectContaining({ conversationId: "conv_1", matchId: "jp_1" }),
    )
    expect(mockDeliverWebhook).toHaveBeenCalledWith(
      employerWebhook,
      "CONVERSATION_COMPLETED",
      expect.objectContaining({ conversationId: "conv_1", matchId: "jp_1" }),
    )
  })

  it("does not fire webhooks when no active CONVERSATION_COMPLETED subscriptions exist", async () => {
    setupMocksWithWebhooks()
    mockDb.webhook.findMany.mockResolvedValue([])

    const step = createMockStep()
    const handler = buildConversationWorkflow()
    await handler({
      event: { data: { jobPostingId: "jp_1", seekerId: "seeker_1", employerId: "emp_1" } },
      step,
    } as never)

    expect(mockDeliverWebhook).not.toHaveBeenCalled()
  })
})
