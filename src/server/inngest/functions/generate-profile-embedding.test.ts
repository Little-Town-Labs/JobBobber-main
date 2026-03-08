import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  },
}))

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockResolvedValue("decrypted-openai-key"),
}))

vi.mock("@/lib/embeddings", () => ({
  buildProfileText: vi.fn().mockReturnValue("Title: Engineer\nSkills: TypeScript"),
  generateEmbedding: vi.fn(),
  profileEmbeddingEventSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: { seekerId: "seeker-1" } }),
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

import { generateProfileEmbedding } from "./generate-profile-embedding"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { buildProfileText, generateEmbedding, profileEmbeddingEventSchema } from "@/lib/embeddings"

const mockDb = db as unknown as {
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  $executeRaw: ReturnType<typeof vi.fn>
}
const mockedDecrypt = vi.mocked(decrypt)
const mockedBuildProfileText = vi.mocked(buildProfileText)
const mockedGenerateEmbedding = vi.mocked(generateEmbedding)
const mockedSchema = vi.mocked(profileEmbeddingEventSchema)

const mockStep = {
  run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}

const handler = generateProfileEmbedding as unknown as (args: {
  event: { data: { seekerId: string } }
  step: typeof mockStep
}) => Promise<{ status: string; error?: string }>

function makeEvent(seekerId = "seeker-1") {
  return { event: { data: { seekerId } }, step: mockStep }
}

function makeSeeker(overrides?: Record<string, unknown>) {
  return {
    id: "seeker-1",
    headline: "Engineer",
    skills: ["TypeScript"],
    experience: [{ title: "Dev", years: 3 }],
    education: [{ degree: "BS" }],
    location: "Remote",
    settings: {
      byokApiKeyEncrypted: "encrypted-key",
      byokProvider: "openai",
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generate-profile-embedding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.$executeRaw.mockResolvedValue(1)
  })

  it("fetches seeker, builds text, generates embedding, updates DB", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.5)
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker())
    mockedGenerateEmbedding.mockResolvedValue(fakeEmbedding)

    const result = await handler(makeEvent())

    expect(result.status).toBe("SUCCESS")
    // decrypt called in generate-embedding step (re-fetches seeker)
    expect(mockedDecrypt).toHaveBeenCalledWith("encrypted-key", "seeker-1")
    expect(mockedBuildProfileText).toHaveBeenCalled()
    expect(mockedGenerateEmbedding).toHaveBeenCalledWith(
      "Title: Engineer\nSkills: TypeScript",
      "decrypted-openai-key",
    )
    expect(mockDb.$executeRaw).toHaveBeenCalled()
  })

  it("skips if seeker has no OpenAI key", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(
      makeSeeker({
        settings: { byokApiKeyEncrypted: null, byokProvider: "anthropic" },
      }),
    )

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
    expect(mockedGenerateEmbedding).not.toHaveBeenCalled()
  })

  it("skips if seeker provider is not openai", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(
      makeSeeker({
        settings: { byokApiKeyEncrypted: "key", byokProvider: "anthropic" },
      }),
    )

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
  })

  it("handles embedding generation failure gracefully", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker())
    mockedGenerateEmbedding.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("embedding generation failed")
    expect(mockDb.$executeRaw).not.toHaveBeenCalled()
  })

  it("skips if profile text is empty (insufficient content)", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(makeSeeker())
    mockedBuildProfileText.mockReturnValue("")

    const result = await handler(makeEvent())

    expect(result.status).toBe("SKIPPED")
    expect(mockedGenerateEmbedding).not.toHaveBeenCalled()
  })

  it("handles seeker not found", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(null)

    const result = await handler(makeEvent())

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("not found")
  })

  it("returns FAILED on invalid event data", async () => {
    mockedSchema.safeParse.mockReturnValue({
      success: false,
      error: { message: "Required" },
    } as never)

    const result = await handler({ event: { data: {} }, step: mockStep })

    expect(result.status).toBe("FAILED")
    expect(result.error).toContain("Invalid event data")
  })
})
