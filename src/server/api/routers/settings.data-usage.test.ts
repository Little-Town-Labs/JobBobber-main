/**
 * Feature 12: Data Usage Opt-Out — Settings Router Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  flagState,
  mockSeekerFindUnique,
  mockEmployerFindUnique,
  mockSeekerSettingsFindUnique,
  mockSeekerSettingsUpsert,
  mockEmployerUpdate,
} = vi.hoisted(() => ({
  flagState: { enabled: true },
  mockSeekerFindUnique: vi.fn(),
  mockEmployerFindUnique: vi.fn(),
  mockSeekerSettingsFindUnique: vi.fn(),
  mockSeekerSettingsUpsert: vi.fn(),
  mockEmployerUpdate: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

vi.mock("@/lib/flags", () => ({
  CONVERSATION_LOGS: () => flagState.enabled,
  PRIVATE_PARAMS: () => true,
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
    jobSeeker: { findUnique: mockSeekerFindUnique },
    employer: { findUnique: mockEmployerFindUnique, update: mockEmployerUpdate },
    seekerSettings: {
      findUnique: mockSeekerSettingsFindUnique,
      upsert: mockSeekerSettingsUpsert,
    },
    jobPosting: { findUnique: vi.fn() },
    jobSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const SEEKER = {
  id: "seeker_01",
  clerkUserId: "user_seeker_01",
  name: "Jane Doe",
  headline: "Engineer",
  skills: [],
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

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: null,
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

import { settingsRouter } from "./settings"
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc"
import { db } from "@/lib/db"

function makeSeekerCaller() {
  const router = createTRPCRouter({ settings: settingsRouter })
  return createCallerFactory(router)({
    db: db as never,
    inngest: {} as never,
    userId: "user_seeker_01",
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER",
  })
}

function makeEmployerCaller() {
  const router = createTRPCRouter({ settings: settingsRouter })
  return createCallerFactory(router)({
    db: db as never,
    inngest: {} as never,
    userId: "user_emp_01",
    orgId: "org_clerk_01",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  })
}

describe("settings.getSeekerDataUsageOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
  })

  it("returns default false when no settings exist", async () => {
    mockSeekerSettingsFindUnique.mockResolvedValue(null)

    const caller = makeSeekerCaller()
    const result = await caller.settings.getSeekerDataUsageOptOut()

    expect(result.optOut).toBe(false)
  })

  it("returns stored preference", async () => {
    mockSeekerSettingsFindUnique.mockResolvedValue({ dataUsageOptOut: true })

    const caller = makeSeekerCaller()
    const result = await caller.settings.getSeekerDataUsageOptOut()

    expect(result.optOut).toBe(true)
  })
})

describe("settings.updateSeekerDataUsageOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockSeekerSettingsUpsert.mockResolvedValue({ dataUsageOptOut: true })
  })

  it("updates and returns new preference", async () => {
    const caller = makeSeekerCaller()
    const result = await caller.settings.updateSeekerDataUsageOptOut({ optOut: true })

    expect(result.optOut).toBe(true)
    expect(mockSeekerSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seekerId: "seeker_01" },
        update: { dataUsageOptOut: true },
      }),
    )
  })
})

describe("settings.getEmployerDataUsageOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
  })

  it("returns employer opt-out preference", async () => {
    const caller = makeEmployerCaller()
    const result = await caller.settings.getEmployerDataUsageOptOut()

    expect(result.optOut).toBe(false)
  })
})

describe("settings.updateEmployerDataUsageOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagState.enabled = true
    mockSeekerFindUnique.mockResolvedValue(SEEKER)
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
    mockEmployerUpdate.mockResolvedValue({ ...EMPLOYER, dataUsageOptOut: true })
  })

  it("updates and returns new preference", async () => {
    const caller = makeEmployerCaller()
    const result = await caller.settings.updateEmployerDataUsageOptOut({ optOut: true })

    expect(result.optOut).toBe(true)
    expect(mockEmployerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp_01" },
        data: { dataUsageOptOut: true },
      }),
    )
  })
})
