/**
 * Task 3.1 — Notification preferences CRUD tests.
 *
 * Tests getNotifPrefs and updateNotifPrefs for both seeker and employer roles.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

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

const SEEKER_SETTINGS = {
  id: "ss_01",
  seekerId: "seeker_01",
  notifPrefs: {},
}

const mockDb = {
  employer: {
    findUnique: vi.fn().mockResolvedValue(EMPLOYER),
    update: vi.fn(),
  },
  jobSeeker: { findUnique: vi.fn().mockResolvedValue(SEEKER) },
  seekerSettings: {
    findUnique: vi.fn().mockResolvedValue(SEEKER_SETTINGS),
    update: vi.fn(),
  },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

async function makeNotifCaller(ctx?: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { notificationsRouter } = await import("@/server/api/routers/notifications")

  return createCallerFactory(createTRPCRouter({ notifications: notificationsRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx?.userId ?? "user_clerk_01",
    orgId: ctx?.orgId ?? "org_clerk_01",
    orgRole: ctx?.orgRole ?? "org:admin",
    userRole: ctx?.userRole ?? "EMPLOYER",
    hasByokKey: false,
    employer: EMPLOYER as never,
    seeker: SEEKER as never,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.employer.findUnique.mockResolvedValue(EMPLOYER)
  mockDb.jobSeeker.findUnique.mockResolvedValue(SEEKER)
  mockDb.seekerSettings.findUnique.mockResolvedValue(SEEKER_SETTINGS)
})

describe("notifications.getNotifPrefs (employer)", () => {
  it("returns defaults when no prefs set", async () => {
    const caller = await makeNotifCaller()
    const result = await caller.notifications.getNotifPrefs()

    expect(result.matchCreated).toBe(true)
    expect(result.mutualAccept).toBe(true)
  })

  it("returns stored prefs when set", async () => {
    mockDb.employer.findUnique.mockResolvedValue({
      ...EMPLOYER,
      notifPrefs: { matchCreated: false, mutualAccept: true },
    })
    const caller = await makeNotifCaller()
    const result = await caller.notifications.getNotifPrefs()

    expect(result.matchCreated).toBe(false)
    expect(result.mutualAccept).toBe(true)
  })
})

describe("notifications.getNotifPrefs (seeker)", () => {
  it("returns defaults when no prefs set", async () => {
    const caller = await makeNotifCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.notifications.getNotifPrefs()

    expect(result.matchCreated).toBe(true)
    expect(result.mutualAccept).toBe(true)
  })

  it("returns stored prefs", async () => {
    mockDb.seekerSettings.findUnique.mockResolvedValue({
      ...SEEKER_SETTINGS,
      notifPrefs: { matchCreated: true, mutualAccept: false },
    })
    const caller = await makeNotifCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.notifications.getNotifPrefs()

    expect(result.mutualAccept).toBe(false)
  })
})

describe("notifications.updateNotifPrefs (employer)", () => {
  it("updates and returns new prefs", async () => {
    mockDb.employer.update.mockResolvedValue({
      ...EMPLOYER,
      notifPrefs: { matchCreated: false, mutualAccept: true },
    })
    const caller = await makeNotifCaller()
    const result = await caller.notifications.updateNotifPrefs({
      matchCreated: false,
    })

    expect(result.matchCreated).toBe(false)
    expect(mockDb.employer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp_01" },
      }),
    )
  })
})

describe("notifications.updateNotifPrefs (seeker)", () => {
  it("updates and returns new prefs", async () => {
    mockDb.seekerSettings.update.mockResolvedValue({
      ...SEEKER_SETTINGS,
      notifPrefs: { matchCreated: true, mutualAccept: false },
    })
    const caller = await makeNotifCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.notifications.updateNotifPrefs({
      mutualAccept: false,
    })

    expect(result.mutualAccept).toBe(false)
    expect(mockDb.seekerSettings.update).toHaveBeenCalled()
  })
})
