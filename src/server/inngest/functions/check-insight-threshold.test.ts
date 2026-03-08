/**
 * Task 3.3 — Threshold Check Function Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockDb = vi.hoisted(() => ({
  feedbackInsights: {
    findUnique: vi.fn(),
  },
  agentConversation: {
    count: vi.fn(),
  },
}))

const mockInngest = vi.hoisted(() => ({
  createFunction: vi.fn((_config: unknown, _event: unknown, handler: unknown) => handler),
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: mockInngest }))

const { checkInsightThreshold } = await import("./check-insight-threshold")

describe("checkInsightThreshold", () => {
  beforeEach(() => vi.clearAllMocks())

  // The handler is the function itself (mocked createFunction returns the handler)
  const handler = checkInsightThreshold as unknown as (args: {
    event: { data: { userId: string; userType: string } }
    step: {
      run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>
      sendEvent: (name: string, event: unknown) => Promise<void>
    }
  }) => Promise<unknown>

  function makeStep() {
    const sendEvent = vi.fn()
    const run = vi.fn((_, fn) => fn())
    return { run, sendEvent }
  }

  it("dispatches generate event when threshold is met", async () => {
    mockDb.feedbackInsights.findUnique.mockResolvedValue({
      lastInsightConversationCount: 5,
    })
    mockDb.agentConversation.count.mockResolvedValue(8)

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "user-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(step.sendEvent).toHaveBeenCalledWith(
      "dispatch-generate",
      expect.objectContaining({
        name: "insights/generate",
        data: { userId: "user-1", userType: "JOB_SEEKER" },
      }),
    )
    expect(result).toEqual({ dispatched: true })
  })

  it("does not dispatch when below threshold", async () => {
    mockDb.feedbackInsights.findUnique.mockResolvedValue({
      lastInsightConversationCount: 7,
    })
    mockDb.agentConversation.count.mockResolvedValue(8)

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "user-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(step.sendEvent).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: false })
  })

  it("dispatches for first-time generation when no existing record", async () => {
    mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
    mockDb.agentConversation.count.mockResolvedValue(3)

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "user-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(step.sendEvent).toHaveBeenCalled()
    expect(result).toEqual({ dispatched: true })
  })

  it("does not dispatch for first-time when below minimum", async () => {
    mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
    mockDb.agentConversation.count.mockResolvedValue(2)

    const step = makeStep()
    const result = await handler({
      event: { data: { userId: "user-1", userType: "JOB_SEEKER" } },
      step,
    })

    expect(step.sendEvent).not.toHaveBeenCalled()
    expect(result).toEqual({ dispatched: false })
  })

  it("handles EMPLOYER userType with jobPostingId filter", async () => {
    mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
    mockDb.agentConversation.count.mockResolvedValue(5)

    const step = makeStep()
    await handler({
      event: { data: { userId: "emp-1", userType: "EMPLOYER" } },
      step,
    })

    // For employers, count uses jobPostingId scope — but the threshold
    // check is by userId+userType, so it still dispatches
    expect(step.sendEvent).toHaveBeenCalled()
  })
})
