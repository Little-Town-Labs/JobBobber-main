import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockStreamText, mockGetAuth, mockCheckRateLimit, mockDecrypt, mockAssembleContext } =
  vi.hoisted(() => ({
    mockStreamText: vi.fn(),
    mockGetAuth: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockDecrypt: vi.fn(),
    mockAssembleContext: vi.fn(),
  }))

vi.mock("ai", () => ({
  streamText: mockStreamText,
}))

vi.mock("@/lib/auth", () => ({
  getAuth: mockGetAuth,
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: mockDecrypt,
}))

vi.mock("@/server/agents/chat-agent", () => ({
  assembleChatContext: mockAssembleContext,
  buildChatSystemPrompt: vi.fn(() => "You are a test agent"),
}))

vi.mock("@/server/agents/employer-agent", () => ({
  createProvider: vi.fn(() => vi.fn(() => "mock-model")),
}))

vi.mock("@/lib/db", () => ({
  db: {
    seekerSettings: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    chatMessage: { create: vi.fn(), findMany: vi.fn() },
  },
}))

const { mockToolCallingFlag } = vi.hoisted(() => ({
  mockToolCallingFlag: vi.fn(() => false),
}))

vi.mock("@/lib/flags", () => ({
  USER_CHAT: vi.fn(() => true),
  AGENT_TOOL_CALLING: mockToolCallingFlag,
  assertFlagEnabled: vi.fn(),
}))

vi.mock("@/server/agents/chat-tools", () => ({
  buildSeekerTools: vi.fn(() => ({ searchJobs: {}, getMyMatches: {} })),
  buildEmployerTools: vi.fn(() => ({ getCandidates: {}, getMyPostings: {} })),
}))

import { POST } from "./route"
import { db } from "@/lib/db"

const mockChatDb = db as unknown as {
  seekerSettings: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  chatMessage: { create: ReturnType<typeof vi.fn> }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(messages: Array<{ role: string; content: string }>) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  })
}

const VALID_MESSAGES = [{ role: "user", content: "Why was I matched with Acme?" }]

const DEFAULT_CONTEXT = {
  userName: "Jane",
  userRole: "JOB_SEEKER",
  profile: { headline: "Dev", skills: [], location: null, profileCompleteness: 0.5, bio: null },
  matches: [],
  privateSettings: null,
  conversationSummaries: [],
  postings: null,
}

function setupAuthenticatedSeeker() {
  mockGetAuth.mockResolvedValue({
    userId: "user_1",
    orgId: null,
    orgRole: null,
    sessionClaims: { metadata: { role: "JOB_SEEKER" } },
  })
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 })
  mockChatDb.jobSeeker.findUnique.mockResolvedValue({ id: "seeker_1", clerkUserId: "user_1" })
  mockChatDb.seekerSettings.findUnique.mockResolvedValue({
    seekerId: "seeker_1",
    byokApiKeyEncrypted: "encrypted_key",
    byokProvider: "openai",
  })
  mockDecrypt.mockResolvedValue("sk-test-key")
  mockAssembleContext.mockResolvedValue(DEFAULT_CONTEXT)
  mockChatDb.chatMessage.create.mockResolvedValue({ id: "msg_1" })

  // Mock streamText to return a response-like object
  mockStreamText.mockReturnValue({
    toTextStreamResponse: () => new Response("streamed data", { status: 200 }),
    text: Promise.resolve("Agent response text"),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/chat", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuth.mockResolvedValue({ userId: null })

    const response = await POST(makeRequest(VALID_MESSAGES))

    expect(response.status).toBe(401)
  })

  it("returns 429 when rate limit exceeded", async () => {
    mockGetAuth.mockResolvedValue({
      userId: "user_1",
      sessionClaims: { metadata: { role: "JOB_SEEKER" } },
    })
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

    const response = await POST(makeRequest(VALID_MESSAGES))

    expect(response.status).toBe(429)
  })

  it("returns 403 when no BYOK key configured (seeker)", async () => {
    mockGetAuth.mockResolvedValue({
      userId: "user_1",
      orgId: null,
      orgRole: null,
      sessionClaims: { metadata: { role: "JOB_SEEKER" } },
    })
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 })
    mockChatDb.jobSeeker.findUnique.mockResolvedValue({ id: "seeker_1", clerkUserId: "user_1" })
    mockChatDb.seekerSettings.findUnique.mockResolvedValue(null)

    const response = await POST(makeRequest(VALID_MESSAGES))

    expect(response.status).toBe(403)
  })

  it("returns 403 when no BYOK key configured (employer)", async () => {
    mockGetAuth.mockResolvedValue({
      userId: "user_1",
      orgId: "org_1",
      orgRole: "org:admin",
      sessionClaims: { metadata: { role: "EMPLOYER" } },
    })
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 })
    mockChatDb.employer.findUnique.mockResolvedValue(null)

    const response = await POST(makeRequest(VALID_MESSAGES))

    expect(response.status).toBe(403)
  })

  it("calls decrypt with correct scopeId for seeker", async () => {
    setupAuthenticatedSeeker()

    await POST(makeRequest(VALID_MESSAGES))

    expect(mockDecrypt).toHaveBeenCalledWith("encrypted_key", "seeker_1")
  })

  it("streams response for authenticated user with valid key", async () => {
    setupAuthenticatedSeeker()

    const response = await POST(makeRequest(VALID_MESSAGES))

    expect(response.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalled()
  })

  it("calls streamText with assembled context as system prompt", async () => {
    setupAuthenticatedSeeker()

    await POST(makeRequest(VALID_MESSAGES))

    expect(mockAssembleContext).toHaveBeenCalled()
    const streamCall = mockStreamText.mock.calls[0]?.[0]
    expect(streamCall).toHaveProperty("system", "You are a test agent")
  })

  it("persists user message to ChatMessage", async () => {
    setupAuthenticatedSeeker()

    await POST(makeRequest(VALID_MESSAGES))

    expect(mockChatDb.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkUserId: "user_1",
          role: "USER",
          content: "Why was I matched with Acme?",
        }),
      }),
    )
  })

  it("rejects messages exceeding 5000 character limit", async () => {
    setupAuthenticatedSeeker()
    const longMessage = "x".repeat(5001)

    const response = await POST(makeRequest([{ role: "user", content: longMessage }]))

    expect(response.status).toBe(400)
  })

  it("includes tools in streamText when AGENT_TOOL_CALLING flag is enabled", async () => {
    setupAuthenticatedSeeker()
    mockToolCallingFlag.mockReturnValue(true)

    await POST(makeRequest(VALID_MESSAGES))

    const streamCall = mockStreamText.mock.calls[0]?.[0]
    expect(streamCall).toHaveProperty("tools")
    expect(streamCall).toHaveProperty("maxSteps", 3)
  })

  it("does NOT include tools when AGENT_TOOL_CALLING flag is disabled", async () => {
    setupAuthenticatedSeeker()
    mockToolCallingFlag.mockReturnValue(false)

    await POST(makeRequest(VALID_MESSAGES))

    const streamCall = mockStreamText.mock.calls[0]?.[0]
    expect(streamCall.tools).toBeUndefined()
    expect(streamCall.maxSteps).toBeUndefined()
  })
})
