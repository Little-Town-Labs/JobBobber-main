/**
 * Task 3.1 — Generate Feedback Insights Inngest Function Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockDb = vi.hoisted(() => ({
  feedbackInsights: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  agentConversation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  match: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  jobPosting: {
    findMany: vi.fn(),
  },
  jobSeeker: {
    findUnique: vi.fn(),
  },
  seekerSettings: {
    findUnique: vi.fn(),
  },
  employer: {
    findUnique: vi.fn(),
  },
}))

const mockDecrypt = vi.hoisted(() => vi.fn())
const mockBuildSeekerContext = vi.hoisted(() => vi.fn())
const mockBuildEmployerContext = vi.hoisted(() => vi.fn())
const mockGenerateInsights = vi.hoisted(() => vi.fn())

const mockInngest = vi.hoisted(() => ({
  createFunction: vi.fn((_config: unknown, _event: unknown, handler: unknown) => handler),
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: mockInngest }))
vi.mock("@/lib/encryption", () => ({ decrypt: mockDecrypt }))
vi.mock("@/server/insights/aggregate-stats", () => ({
  buildSeekerInsightContext: mockBuildSeekerContext,
  buildEmployerInsightContext: mockBuildEmployerContext,
}))
vi.mock("@/server/insights/generate-insights", () => ({
  generateFeedbackInsights: mockGenerateInsights,
}))

const { generateFeedbackInsightsFunction } = await import("./generate-feedback-insights")

describe("generateFeedbackInsightsFunction", () => {
  beforeEach(() => vi.clearAllMocks())

  const handler = generateFeedbackInsightsFunction as unknown as (args: {
    event: { data: { userId: string; userType: string } }
    step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }
  }) => Promise<unknown>

  function makeStep() {
    return { run: vi.fn((_, fn) => fn()) }
  }

  it("generates and upserts seeker insights", async () => {
    const mockContext = {
      userType: "JOB_SEEKER",
      totalConversations: 5,
      completedMatchCount: 2,
      completedNoMatchCount: 3,
      terminatedCount: 0,
      inProgressCount: 0,
      matchRate: 0.4,
      acceptanceRate: 0.5,
      confidenceDistribution: { STRONG: 1, GOOD: 1, POTENTIAL: 0 },
      recentOutcomes: ["MATCH", "NO_MATCH"],
      overallMatchRate: 0.4,
      recentMatchRate: 0.5,
      patternSummaries: [],
    }
    const mockOutput = {
      strengths: ["Good technical skills"],
      weaknesses: ["Limited experience"],
      recommendations: ["Expand portfolio"],
    }

    mockDb.seekerSettings.findUnique.mockResolvedValue({
      byokApiKeyEncrypted: "encrypted-key",
      byokProvider: "openai",
    })
    mockBuildSeekerContext.mockResolvedValue(mockContext)
    mockDecrypt.mockResolvedValue("sk-test-key")
    mockGenerateInsights.mockResolvedValue(mockOutput)
    mockDb.agentConversation.count.mockResolvedValue(5)
    mockDb.feedbackInsights.upsert.mockResolvedValue({ id: "insight-1" })

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "seeker-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(mockBuildSeekerContext).toHaveBeenCalledWith("seeker-1")
    expect(mockGenerateInsights).toHaveBeenCalled()
    expect(mockDb.feedbackInsights.upsert).toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ status: "GENERATED" }))
  })

  it("generates employer insights", async () => {
    const mockContext = {
      userType: "EMPLOYER",
      totalConversations: 5,
      completedMatchCount: 3,
      completedNoMatchCount: 2,
      terminatedCount: 0,
      inProgressCount: 0,
      matchRate: 0.6,
      acceptanceRate: 0.8,
      confidenceDistribution: { STRONG: 2, GOOD: 1, POTENTIAL: 0 },
      recentOutcomes: ["MATCH", "MATCH"],
      overallMatchRate: 0.6,
      recentMatchRate: 1.0,
      patternSummaries: [],
    }

    mockDb.employer.findUnique.mockResolvedValue({
      id: "emp-1",
      byokApiKeyEncrypted: "encrypted-key",
      byokProvider: "anthropic",
    })
    mockBuildEmployerContext.mockResolvedValue(mockContext)
    mockDecrypt.mockResolvedValue("sk-test-key")
    mockGenerateInsights.mockResolvedValue({
      strengths: ["Clear job descriptions"],
      weaknesses: ["Salary range unclear"],
      recommendations: ["Add more detail"],
    })
    mockDb.agentConversation.count.mockResolvedValue(5)
    mockDb.feedbackInsights.upsert.mockResolvedValue({ id: "insight-1" })

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "emp-1", userType: "EMPLOYER" } },
      step,
    })

    expect(mockBuildEmployerContext).toHaveBeenCalledWith("emp-1")
    expect(result).toEqual(expect.objectContaining({ status: "GENERATED" }))
  })

  it("stores metrics only when no BYOK key available", async () => {
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      byokApiKeyEncrypted: null,
      byokProvider: null,
    })
    mockBuildSeekerContext.mockResolvedValue({
      userType: "JOB_SEEKER",
      totalConversations: 5,
      completedMatchCount: 2,
      completedNoMatchCount: 3,
      terminatedCount: 0,
      inProgressCount: 0,
      matchRate: 0.4,
      acceptanceRate: 0.5,
      confidenceDistribution: { STRONG: 0, GOOD: 1, POTENTIAL: 1 },
      recentOutcomes: [],
      overallMatchRate: 0.4,
      recentMatchRate: 0,
      patternSummaries: [],
    })
    mockDb.agentConversation.count.mockResolvedValue(5)
    mockDb.feedbackInsights.upsert.mockResolvedValue({ id: "insight-1" })

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "seeker-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(mockGenerateInsights).not.toHaveBeenCalled()
    expect(mockDb.feedbackInsights.upsert).toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ status: "METRICS_ONLY" }))
  })

  it("skips generation when below threshold", async () => {
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      byokApiKeyEncrypted: "key",
      byokProvider: "openai",
    })
    mockBuildSeekerContext.mockResolvedValue({
      userType: "JOB_SEEKER",
      totalConversations: 1,
      completedMatchCount: 0,
      completedNoMatchCount: 1,
      terminatedCount: 0,
      inProgressCount: 0,
      matchRate: 0,
      acceptanceRate: 0,
      confidenceDistribution: { STRONG: 0, GOOD: 0, POTENTIAL: 0 },
      recentOutcomes: ["NO_MATCH"],
      overallMatchRate: 0,
      recentMatchRate: 0,
      patternSummaries: [],
    })
    mockDb.agentConversation.count.mockResolvedValue(1)

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "seeker-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(mockGenerateInsights).not.toHaveBeenCalled()
    expect(mockDb.feedbackInsights.upsert).not.toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ status: "BELOW_THRESHOLD" }))
  })
})
