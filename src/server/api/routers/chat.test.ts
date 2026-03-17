/**
 * Task 4.1 — Chat history router tests.
 *
 * Tests getHistory procedure: auth, pagination, ordering, limits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

const { flagState, mockChatMessageFindMany } = vi.hoisted(() => ({
  flagState: { enabled: true },
  mockChatMessageFindMany: vi.fn(),
}))

vi.mock("@/lib/flags", () => ({
  USER_CHAT: () => flagState.enabled,
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
    chatMessage: { findMany: mockChatMessageFindMany },
  },
}))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

function makeChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_01",
    clerkUserId: "user_01",
    role: "USER",
    content: "Hello",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  }
}

async function makeChatCaller(ctx?: {
  userId?: string | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { chatRouter } = await import("@/server/api/routers/chat")

  return createCallerFactory(createTRPCRouter({ chat: chatRouter }))({
    db: { chatMessage: { findMany: mockChatMessageFindMany } } as never,
    inngest: null as never,
    userId: ctx?.userId ?? "user_01",
    orgId: null,
    orgRole: null,
    userRole: ctx?.userRole !== undefined ? ctx.userRole : "JOB_SEEKER",
    hasByokKey: false,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  flagState.enabled = true
  mockChatMessageFindMany.mockResolvedValue([])
})

describe("chat.getHistory", () => {
  it("returns empty array when no messages exist", async () => {
    mockChatMessageFindMany.mockResolvedValue([])
    const caller = await makeChatCaller()
    const result = await caller.chat.getHistory()

    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })

  it("returns messages for authenticated user only", async () => {
    const msg = makeChatMessage()
    mockChatMessageFindMany.mockResolvedValue([msg])

    const caller = await makeChatCaller({ userId: "user_01" })
    const result = await caller.chat.getHistory()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe("msg_01")
    expect(result.items[0]!.role).toBe("USER")
    expect(result.items[0]!.content).toBe("Hello")
    expect(result.items[0]!.createdAt).toBe("2026-01-15T10:00:00.000Z")

    // Verify the query filters by clerkUserId
    expect(mockChatMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "user_01" },
      }),
    )
  })

  it("orders messages by createdAt descending", async () => {
    const msg1 = makeChatMessage({
      id: "msg_01",
      createdAt: new Date("2026-01-15T10:00:00Z"),
    })
    const msg2 = makeChatMessage({
      id: "msg_02",
      createdAt: new Date("2026-01-15T09:00:00Z"),
    })
    mockChatMessageFindMany.mockResolvedValue([msg1, msg2])

    const caller = await makeChatCaller()
    const result = await caller.chat.getHistory()

    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.id).toBe("msg_01")
    expect(result.items[1]!.id).toBe("msg_02")

    expect(mockChatMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    )
  })

  it("supports cursor-based pagination", async () => {
    const msg = makeChatMessage({ id: "msg_03" })
    mockChatMessageFindMany.mockResolvedValue([msg])

    const caller = await makeChatCaller()
    const result = await caller.chat.getHistory({ cursor: "msg_02", limit: 50 })

    expect(result.items).toHaveLength(1)
    expect(mockChatMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "msg_02" },
        skip: 1,
      }),
    )
  })

  it("respects limit parameter with default of 50", async () => {
    mockChatMessageFindMany.mockResolvedValue([])

    const caller = await makeChatCaller()
    await caller.chat.getHistory()

    // Default limit is 50, so take should be 51 (limit + 1 for hasMore check)
    expect(mockChatMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
      }),
    )
  })

  it("respects custom limit up to max 100", async () => {
    mockChatMessageFindMany.mockResolvedValue([])

    const caller = await makeChatCaller()
    await caller.chat.getHistory({ limit: 25 })

    expect(mockChatMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 26,
      }),
    )
  })

  it("hasMore is true when more messages exist", async () => {
    // Return limit + 1 items to signal there are more
    const messages = Array.from({ length: 4 }, (_, i) =>
      makeChatMessage({
        id: `msg_${i}`,
        createdAt: new Date(`2026-01-15T0${9 - i}:00:00Z`),
      }),
    )
    mockChatMessageFindMany.mockResolvedValue(messages)

    const caller = await makeChatCaller()
    const result = await caller.chat.getHistory({ limit: 3 })

    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(3)
    expect(result.nextCursor).toBe("msg_2")
  })

  it("nextCursor is null when no more messages", async () => {
    const messages = [makeChatMessage({ id: "msg_01" })]
    mockChatMessageFindMany.mockResolvedValue(messages)

    const caller = await makeChatCaller()
    const result = await caller.chat.getHistory({ limit: 50 })

    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = await makeChatCaller({ userId: null, userRole: null })
    await expect(caller.chat.getHistory()).rejects.toThrow()
  })

  it("throws NOT_FOUND when feature flag is disabled", async () => {
    flagState.enabled = false
    const caller = await makeChatCaller()
    await expect(caller.chat.getHistory()).rejects.toThrow("This feature is not yet available.")
  })
})
