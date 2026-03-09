import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    jobPosting: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  },
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockResolvedValue("decrypted-openai-key"),
}))

vi.mock("@/lib/embeddings", () => ({
  buildPostingText: vi.fn().mockReturnValue("Title: Engineer\nDescription: Build things"),
  generateEmbedding: vi.fn(),
  postingEmbeddingEventSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { jobPostingId: "jp-1", employerId: "emp-1" },
    }),
  },
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { generatePostingEmbedding } from "./generate-posting-embedding"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { buildPostingText, generateEmbedding, postingEmbeddingEventSchema } from "@/lib/embeddings"

const mockDb = db as unknown as {
  jobPosting: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  $executeRaw: ReturnType<typeof vi.fn>
}
const mockedDecrypt = vi.mocked(decrypt)
const mockedBuildPostingText = vi.mocked(buildPostingText)
const mockedGenerateEmbedding = vi.mocked(generateEmbedding)
const mockedSchema = vi.mocked(postingEmbeddingEventSchema)

const mockStep = {
  run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}

const handler = generatePostingEmbedding as unknown as (args: {
  event: { data: { jobPostingId: string; employerId: string } }
  step: typeof mockStep
}) => Promise<{ status: string; error?: string }>

function makeEvent(jobPostingId = "jp-1", employerId = "emp-1") {
  return { event: { data: { jobPostingId, employerId } }, step: mockStep }
}

function makePosting(overrides?: Record<string, unknown>) {
  return {
    id: "jp-1",
    title: "Engineer",
    description: "Build things",
    requiredSkills: ["TypeScript"],
    experienceLevel: "MID",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    locationReq: null,
    salaryMin: 80000,
    salaryMax: 120000,
    ...overrides,
  }
}

function makeEmployer(overrides?: Record<string, unknown>) {
  return {
    id: "emp-1",
    byokApiKeyEncrypted: "encrypted-key",
    byokProvider: "openai",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generate-posting-embedding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.$executeRaw.mockResolvedValue(1)
  })

  it("fetches posting, builds text, generates embedding, updates DB", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.5)
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedGenerateEmbedding.mockResolvedValue(fakeEmbedding)

    const result = await handler(makeEvent())

    expect(result.status).toBe("SUCCESS")
    // decrypt called in generate-embedding step (re-fetches employer)
    expect(mockedDecrypt).toHaveBeenCalledWith("encrypted-key", "emp-1")
    expect(mockedBuildPostingText).toHaveBeenCalled()
    expect(mockedGenerateEmbedding).toHaveBeenCalledWith(
      "Title: Engineer\nDescription: Build things",
      "decrypted-openai-key",
    )
    expect(mockDb.$executeRaw).toHaveBeenCalled()
  })

  it("skips if employer has no OpenAI key", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer({ byokApiKeyEncrypted: null }))

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
    expect(mockedGenerateEmbedding).not.toHaveBeenCalled()
  })

  it("skips if employer provider is not openai", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer({ byokProvider: "anthropic" }))

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
  })

  it("handles embedding generation failure", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())
    mockedGenerateEmbedding.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("embedding generation failed")
    expect(mockDb.$executeRaw).not.toHaveBeenCalled()
  })

  it("handles posting not found", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(null)
    mockDb.employer.findUnique.mockResolvedValue(makeEmployer())

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("not found")
  })

  it("handles employer not found", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(makePosting())
    mockDb.employer.findUnique.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
  })

  it("returns FAILED on invalid event data", async () => {
    mockedSchema.safeParse.mockReturnValue({
      success: false,
      error: { message: "Required" },
    } as never)

    const result = await handler({
      event: { data: {} as { jobPostingId: string; employerId: string } },
      step: mockStep,
    })

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("Invalid event data")
  })
})
