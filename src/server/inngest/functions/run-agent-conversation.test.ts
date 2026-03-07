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
  },
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
}
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

  it("creates AgentConversation record with IN_PROGRESS status", async () => {
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
