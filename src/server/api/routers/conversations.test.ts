/**
 * Feature 12: Conversation Logs — Router Tests
 *
 * Tests listForSeeker, listForEmployer, getById with authorization and redaction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

const {
  flagState,
  mockConversationFindMany,
  mockConversationFindUnique,
  mockConversationCount,
  mockEmployerFindUnique,
  mockSeekerFindUnique,
  mockPostingFindUnique,
  mockEmployerMemberFindUnique,
} = vi.hoisted(() => ({
  flagState: { enabled: true },
  mockConversationFindMany: vi.fn(),
  mockConversationFindUnique: vi.fn(),
  mockConversationCount: vi.fn(),
  mockEmployerFindUnique: vi.fn(),
  mockSeekerFindUnique: vi.fn(),
  mockPostingFindUnique: vi.fn(),
  mockEmployerMemberFindUnique: vi.fn(),
}))

vi.mock("@/lib/flags", () => ({
  CONVERSATION_LOGS: () => flagState.enabled,
  assertFlagEnabled: async (flagFn: () => boolean | Promise<boolean>) => {
    const enabled = await flagFn()
    if (!enabled) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  },
}))

vi.mock("@/lib/db", () => ({
  db: {
    employer: { findUnique: mockEmployerFindUnique },
    employerMember: { findUnique: mockEmployerMemberFindUnique },
    jobSeeker: { findUnique: mockSeekerFindUnique },
    jobPosting: { findUnique: mockPostingFindUnique },
    agentConversation: {
      findMany: mockConversationFindMany,
      findUnique: mockConversationFindUnique,
      count: mockConversationCount,
    },
  },
}))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: null,
  headquarters: null,
  locations: [],
  websiteUrl: null,
  urls: {},
  benefits: [],
  logoUrl: null,
  byokApiKeyEncrypted: null,
  byokProvider: null,
  byokKeyValidatedAt: null,
  byokMaskedKey: null,
  notifPrefs: {},
  dataUsageOptOut: false,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const SEEKER = {
  id: "seeker_01",
  clerkUserId: "user_seeker_01",
  name: "Jane Doe",
  headline: "Engineer",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  location: "NYC",
  profileCompleteness: 80,
  isActive: true,
  resumeUrl: null,
  resumeOriginalName: null,
  resumeParsedData: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

import { conversationsRouter } from "./conversations"
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc"
import { db } from "@/lib/db"

function makeCaller(overrides: Record<string, unknown> = {}) {
  const router = createTRPCRouter({ conversations: conversationsRouter })
  return createCallerFactory(router)({
    db: db as never,
    inngest: {} as never,
    userId: "user_seeker_01",
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER",
    ...overrides,
  })
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv_01",
    jobPostingId: "post_01",
    seekerId: "seeker_01",
    status: "COMPLETED_MATCH",
    messages: [
      {
        role: "employer_agent",
        content: "The salary range is $100,000-$120,000.",
        phase: "negotiation",
        timestamp: "2026-03-07T10:00:00Z",
        turnNumber: 1,
        decision: "CONTINUE",
        evaluation: {
          agentRole: "employer_agent",
          overallScore: 85,
          recommendation: "MATCH",
          reasoning: "Strong match on all dimensions with good alignment",
          dimensions: [
            { name: "skills_alignment", score: 90, reasoning: "Strong TypeScript match" },
            { name: "experience_fit", score: 80, reasoning: "Good mid-level fit" },
            { name: "compensation_alignment", score: 85, reasoning: "Within budget" },
            { name: "culture_fit", score: 82, reasoning: "Remote alignment good" },
          ],
        },
      },
      {
        role: "seeker_agent",
        content: "I'd be happy with that range. My minimum is $95k.",
        phase: "negotiation",
        timestamp: "2026-03-07T10:01:00Z",
        turnNumber: 2,
      },
    ],
    startedAt: new Date("2026-03-07T10:00:00Z"),
    completedAt: new Date("2026-03-07T10:10:00Z"),
    outcome: "Mutual match at turn 6",
    inngestRunId: "run_01",
    jobPosting: { id: "post_01", title: "Senior Engineer", employerId: "emp_01" },
    seeker: { id: "seeker_01", name: "Jane Doe" },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// listForSeeker
// ---------------------------------------------------------------------------

describe("conversations.listForSeeker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
  })

  it("returns paginated conversations for seeker", async () => {
    const conv = makeConversation()
    mockConversationFindMany.mockResolvedValue([conv])

    const caller = makeCaller()
    const result = await caller.conversations.listForSeeker({})

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe("conv_01")
    expect(result.hasMore).toBe(false)
  })

  it("returns hasMore when more results exist", async () => {
    const items = Array.from({ length: 21 }, (_, i) => makeConversation({ id: `conv_${i}` }))
    mockConversationFindMany.mockResolvedValue(items)

    const caller = makeCaller()
    const result = await caller.conversations.listForSeeker({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe("conv_19")
  })

  it("filters by status", async () => {
    mockConversationFindMany.mockResolvedValue([])

    const caller = makeCaller()
    await caller.conversations.listForSeeker({ status: "COMPLETED_MATCH" })

    expect(mockConversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "COMPLETED_MATCH" }),
      }),
    )
  })

  it("returns NOT_FOUND when flag is off", async () => {
    flagState.enabled = false
    const caller = makeCaller()

    await expect(caller.conversations.listForSeeker({})).rejects.toThrow(
      "This feature is not yet available.",
    )
  })
})

// ---------------------------------------------------------------------------
// listForEmployer
// ---------------------------------------------------------------------------

describe("conversations.listForEmployer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
    mockEmployerMemberFindUnique.mockResolvedValue({
      id: "member-1",
      employerId: "emp_01",
      clerkUserId: "user_emp_01",
      role: "ADMIN",
    })
  })

  it("returns conversations for employer's posting", async () => {
    mockPostingFindUnique.mockResolvedValue({
      id: "post_01",
      employerId: "emp_01",
      title: "Senior Engineer",
    })
    mockConversationFindMany.mockResolvedValue([makeConversation()])

    const caller = makeCaller({
      userId: "user_emp_01",
      orgId: "org_clerk_01",
      orgRole: "org:admin",
      userRole: "EMPLOYER",
    })
    const result = await caller.conversations.listForEmployer({
      jobPostingId: "post_01",
    })

    expect(result.items).toHaveLength(1)
  })

  it("rejects if employer doesn't own the posting", async () => {
    mockPostingFindUnique.mockResolvedValue({
      id: "post_01",
      employerId: "emp_other",
      title: "Other Posting",
    })

    const caller = makeCaller({
      userId: "user_emp_01",
      orgId: "org_clerk_01",
      orgRole: "org:admin",
      userRole: "EMPLOYER",
    })

    await expect(caller.conversations.listForEmployer({ jobPostingId: "post_01" })).rejects.toThrow(
      "Posting not found",
    )
  })

  it("rejects if posting doesn't exist", async () => {
    mockPostingFindUnique.mockResolvedValue(null)

    const caller = makeCaller({
      userId: "user_emp_01",
      orgId: "org_clerk_01",
      orgRole: "org:admin",
      userRole: "EMPLOYER",
    })

    await expect(
      caller.conversations.listForEmployer({ jobPostingId: "nonexistent" }),
    ).rejects.toThrow("Posting not found")
  })
})

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("conversations.getById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
    mockEmployerMemberFindUnique.mockResolvedValue({
      id: "member-1",
      employerId: "emp_01",
      clerkUserId: "user_emp_01",
      role: "ADMIN",
    })
  })

  it("returns conversation with redacted messages for seeker", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation())

    const caller = makeCaller()
    const result = await caller.conversations.getById({ conversationId: "conv_01" })

    expect(result.id).toBe("conv_01")
    expect(result.messages).toHaveLength(2)
    // messages is typed as `unknown` at the router boundary; cast for assertions
    const firstMessage = result.messages[0] as { content: string }
    // Verify redaction: dollar amounts stripped
    expect(firstMessage.content).not.toContain("$100,000")
    expect(firstMessage.content).toContain("[REDACTED]")
    // Verify evaluation stripped
    expect(result.messages[0]).not.toHaveProperty("evaluation")
    expect(result.messages[0]).not.toHaveProperty("decision")
  })

  it("rejects if seeker doesn't own the conversation", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ seekerId: "seeker_other" }))

    const caller = makeCaller()

    await expect(caller.conversations.getById({ conversationId: "conv_01" })).rejects.toThrow()
  })

  it("returns conversation for employer who owns the posting", async () => {
    const conv = makeConversation()
    mockConversationFindUnique.mockResolvedValue(conv)

    const caller = makeCaller({
      userId: "user_emp_01",
      orgId: "org_clerk_01",
      orgRole: "org:admin",
      userRole: "EMPLOYER",
    })
    const result = await caller.conversations.getById({ conversationId: "conv_01" })

    expect(result.id).toBe("conv_01")
    expect(result.candidateName).toBe("Jane Doe")
  })

  it("rejects if employer doesn't own the posting", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        jobPosting: { id: "post_01", title: "Other", employerId: "emp_other" },
      }),
    )

    const caller = makeCaller({
      userId: "user_emp_01",
      orgId: "org_clerk_01",
      orgRole: "org:admin",
      userRole: "EMPLOYER",
    })

    await expect(caller.conversations.getById({ conversationId: "conv_01" })).rejects.toThrow()
  })

  it("returns NOT_FOUND when conversation doesn't exist", async () => {
    mockConversationFindUnique.mockResolvedValue(null)

    const caller = makeCaller()

    await expect(caller.conversations.getById({ conversationId: "nonexistent" })).rejects.toThrow(
      "Conversation not found",
    )
  })

  it("includes jobPostingTitle in response", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation())

    const caller = makeCaller()
    const result = await caller.conversations.getById({ conversationId: "conv_01" })

    expect(result.jobPostingTitle).toBe("Senior Engineer")
  })
})
