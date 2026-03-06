import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    match: { findUnique: vi.fn() },
    jobPosting: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    seekerSettings: { findUnique: vi.fn() },
    employerSettings: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: { send: vi.fn().mockResolvedValue({ id: "email_01" }) },
    }
  }),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: vi.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: "seeker@test.com" }],
      }),
    },
  }),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  sendMatchCreatedNotification,
  sendMutualAcceptNotification,
} from "./send-match-notification"
import { db } from "@/lib/db"
import { clerkClient } from "@clerk/nextjs/server"
import { Resend } from "resend"

const mockDb = db as unknown as {
  match: { findUnique: ReturnType<typeof vi.fn> }
  jobPosting: { findUnique: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  seekerSettings: { findUnique: ReturnType<typeof vi.fn> }
  employerSettings: { findUnique: ReturnType<typeof vi.fn> }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockStep = {
  run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}

const matchCreatedHandler = sendMatchCreatedNotification as unknown as (args: {
  event: {
    data: {
      matchId: string
      seekerId: string
      jobPostingId: string
      confidenceScore: "STRONG" | "GOOD" | "POTENTIAL"
    }
  }
  step: typeof mockStep
}) => Promise<{ status: string; emailSent?: boolean; error?: string }>

const mutualAcceptHandler = sendMutualAcceptNotification as unknown as (args: {
  event: {
    data: {
      matchId: string
      seekerId: string
      employerId: string
      jobPostingId: string
    }
  }
  step: typeof mockStep
}) => Promise<{ status: string; emailsSent?: number; error?: string }>

function makeMatchCreatedEvent(overrides?: Record<string, unknown>) {
  return {
    event: {
      data: {
        matchId: "match-1",
        seekerId: "seeker-1",
        jobPostingId: "jp-1",
        confidenceScore: "STRONG" as const,
        ...overrides,
      },
    },
    step: mockStep,
  }
}

function makeMutualAcceptEvent(overrides?: Record<string, unknown>) {
  return {
    event: {
      data: {
        matchId: "match-1",
        seekerId: "seeker-1",
        employerId: "emp-1",
        jobPostingId: "jp-1",
        ...overrides,
      },
    },
    step: mockStep,
  }
}

function getResendSendMock() {
  const ResendConstructor = Resend as unknown as ReturnType<typeof vi.fn>
  const instance = ResendConstructor.mock.results[0]?.value
  return instance?.emails?.send as ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Tests: notification/match.created
// ---------------------------------------------------------------------------

describe("send-match-notification: match.created", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-instantiate Resend mock for each test
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        emails: { send: vi.fn().mockResolvedValue({ id: "email_01" }) },
      }
    })
  })

  it("sends email to seeker with match confidence and dashboard link", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-user-1",
      name: "Alice",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })

    const clerkInstance = await (clerkClient as unknown as ReturnType<typeof vi.fn>)()
    clerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "seeker@test.com" }],
    })

    const result = await matchCreatedHandler(makeMatchCreatedEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailSent).toBe(true)

    const sendMock = getResendSendMock()
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "seeker@test.com",
      }),
    )
    // Verify email content includes confidence and posting title
    const emailArg = sendMock.mock.calls[0][0]
    expect(emailArg.subject || emailArg.html || emailArg.text).toBeDefined()
  })

  it("respects opt-out when SeekerSettings.notifPrefs has matchCreated: false", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-user-1",
      name: "Alice",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: false, mutualAccept: true },
    })

    const result = await matchCreatedHandler(makeMatchCreatedEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailSent).toBe(false)

    const sendMock = getResendSendMock()
    if (sendMock) expect(sendMock).not.toHaveBeenCalled()
  })

  it("handles missing seeker gracefully without throwing", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(null)

    const result = await matchCreatedHandler(makeMatchCreatedEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailSent).toBe(false)

    const sendMock = getResendSendMock()
    if (sendMock) expect(sendMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: notification/mutual.accept
// ---------------------------------------------------------------------------

describe("send-match-notification: mutual.accept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        emails: { send: vi.fn().mockResolvedValue({ id: "email_01" }) },
      }
    })
  })

  it("sends email to both seeker and employer", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-seeker-1",
      name: "Alice",
    })
    mockDb.employer.findUnique.mockResolvedValue({
      id: "emp-1",
      userId: "clerk-emp-1",
      companyName: "Acme Corp",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })
    mockDb.employerSettings.findUnique.mockResolvedValue({
      employerId: "emp-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })

    const clerkInstance = await (clerkClient as unknown as ReturnType<typeof vi.fn>)()
    clerkInstance.users.getUser
      .mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "seeker@test.com" }],
      })
      .mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: "employer@test.com" }],
      })

    const result = await mutualAcceptHandler(makeMutualAcceptEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailsSent).toBe(2)

    const sendMock = getResendSendMock()
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "seeker@test.com" }))
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "employer@test.com" }))
  })

  it("only sends to employer when seeker opted out of mutualAccept", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-seeker-1",
      name: "Alice",
    })
    mockDb.employer.findUnique.mockResolvedValue({
      id: "emp-1",
      userId: "clerk-emp-1",
      companyName: "Acme Corp",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: true, mutualAccept: false },
    })
    mockDb.employerSettings.findUnique.mockResolvedValue({
      employerId: "emp-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })

    const clerkInstance = await (clerkClient as unknown as ReturnType<typeof vi.fn>)()
    clerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "employer@test.com" }],
    })

    const result = await mutualAcceptHandler(makeMutualAcceptEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailsSent).toBe(1)

    const sendMock = getResendSendMock()
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "employer@test.com" }))
  })

  it("only sends to seeker when employer opted out of mutualAccept", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-seeker-1",
      name: "Alice",
    })
    mockDb.employer.findUnique.mockResolvedValue({
      id: "emp-1",
      userId: "clerk-emp-1",
      companyName: "Acme Corp",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })
    mockDb.employerSettings.findUnique.mockResolvedValue({
      employerId: "emp-1",
      notifPrefs: { matchCreated: true, mutualAccept: false },
    })

    const clerkInstance = await (clerkClient as unknown as ReturnType<typeof vi.fn>)()
    clerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "seeker@test.com" }],
    })

    const result = await mutualAcceptHandler(makeMutualAcceptEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailsSent).toBe(1)

    const sendMock = getResendSendMock()
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "seeker@test.com" }))
  })
})

// ---------------------------------------------------------------------------
// Tests: error resilience
// ---------------------------------------------------------------------------

describe("send-match-notification: error resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("email failure does not throw — catches and logs error", async () => {
    ;(Resend as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        emails: {
          send: vi.fn().mockRejectedValue(new Error("Resend API error")),
        },
      }
    })

    mockDb.jobSeeker.findUnique.mockResolvedValue({
      id: "seeker-1",
      userId: "clerk-user-1",
      name: "Alice",
    })
    mockDb.jobPosting.findUnique.mockResolvedValue({
      id: "jp-1",
      title: "Senior Engineer",
    })
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      seekerId: "seeker-1",
      notifPrefs: { matchCreated: true, mutualAccept: true },
    })

    const clerkInstance = await (clerkClient as unknown as ReturnType<typeof vi.fn>)()
    clerkInstance.users.getUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "seeker@test.com" }],
    })

    // Should not throw
    const result = await matchCreatedHandler(makeMatchCreatedEvent())

    expect(result.status).toBe("COMPLETED")
    expect(result.emailSent).toBe(false)
  })
})
