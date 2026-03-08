/**
 * Task 2.1 — Tests for activity logging utility.
 *
 * Verifies:
 * - Creates ActivityLog record with correct fields
 * - Swallows errors without throwing (fire-and-forget)
 * - Handles missing optional fields
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockCreate = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    activityLog: {
      create: mockCreate,
    },
  },
}))

describe("logActivity", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates an activity log record with all fields", async () => {
    mockCreate.mockResolvedValue({ id: "log_01" })

    const { logActivity } = await import("@/lib/activity-log")

    await logActivity({
      employerId: "emp_01",
      actorClerkUserId: "user_abc",
      actorName: "John Admin",
      action: "posting.created",
      targetType: "JobPosting",
      targetId: "post_01",
      targetLabel: "Senior Engineer",
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        employerId: "emp_01",
        actorClerkUserId: "user_abc",
        actorName: "John Admin",
        action: "posting.created",
        targetType: "JobPosting",
        targetId: "post_01",
        targetLabel: "Senior Engineer",
      },
    })
  })

  it("creates a record with optional fields omitted", async () => {
    mockCreate.mockResolvedValue({ id: "log_02" })

    const { logActivity } = await import("@/lib/activity-log")

    await logActivity({
      employerId: "emp_01",
      actorClerkUserId: "user_abc",
      actorName: "John Admin",
      action: "member.invited",
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        employerId: "emp_01",
        actorClerkUserId: "user_abc",
        actorName: "John Admin",
        action: "member.invited",
        targetType: undefined,
        targetId: undefined,
        targetLabel: undefined,
      },
    })
  })

  it("swallows errors without throwing", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection failed"))

    const { logActivity } = await import("@/lib/activity-log")

    // Should not throw
    await expect(
      logActivity({
        employerId: "emp_01",
        actorClerkUserId: "user_abc",
        actorName: "John Admin",
        action: "posting.created",
      }),
    ).resolves.toBeUndefined()
  })
})
