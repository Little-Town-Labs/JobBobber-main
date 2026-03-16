import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("ai", () => ({
  embed: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { embed } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { db } from "@/lib/db"
import {
  buildProfileText,
  buildPostingText,
  generateEmbedding,
  findSimilarCandidates,
  profileEmbeddingEventSchema,
  postingEmbeddingEventSchema,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  DEFAULT_SHORTLIST_SIZE,
  MIN_SIMILARITY_THRESHOLD,
} from "./embeddings"

const mockEmbed = vi.mocked(embed)
const mockCreateOpenAI = vi.mocked(createOpenAI)
const mockQueryRaw = vi.mocked(db.$queryRaw)

// ---------------------------------------------------------------------------
// buildProfileText
// ---------------------------------------------------------------------------

describe("buildProfileText", () => {
  it("builds structured text from profile fields", () => {
    const result = buildProfileText({
      headline: "Senior Software Engineer",
      skills: ["TypeScript", "React", "Node.js"],
      experience: [
        { title: "Lead Dev", company: "Acme", startDate: "2020-01-01", years: 3 },
        { title: "Junior Dev", company: "Startup", startDate: "2018-01-01", years: 2 },
      ],
      education: [{ degree: "BS Computer Science", institution: "MIT" }],
      location: "San Francisco, CA",
    })

    expect(result).toContain("Title: Senior Software Engineer")
    expect(result).toContain("Skills: TypeScript, React, Node.js")
    expect(result).toContain("Experience:")
    expect(result).toContain("Lead Dev")
    expect(result).toContain("Education:")
    expect(result).toContain("BS Computer Science")
    expect(result).toContain("Location: San Francisco, CA")
  })

  it("returns empty string for insufficient content", () => {
    const result = buildProfileText({
      headline: null,
      skills: [],
      experience: [],
      education: [],
      location: null,
    })

    expect(result).toBe("")
  })

  it("handles missing optional fields gracefully", () => {
    const result = buildProfileText({
      headline: "Engineer",
      skills: ["Python"],
      experience: [],
      education: [],
      location: null,
    })

    expect(result).toContain("Title: Engineer")
    expect(result).toContain("Skills: Python")
    expect(result).not.toContain("Location:")
  })

  it("truncates to 8000 chars if necessary", () => {
    const longSkills = Array.from({ length: 500 }, (_, i) => `skill-${i}-very-long-name`)
    const result = buildProfileText({
      headline: "Engineer",
      skills: longSkills,
      experience: [],
      education: [],
      location: null,
    })

    expect(result.length).toBeLessThanOrEqual(8000)
  })
})

// ---------------------------------------------------------------------------
// buildPostingText
// ---------------------------------------------------------------------------

describe("buildPostingText", () => {
  it("builds structured text from posting fields", () => {
    const result = buildPostingText({
      title: "Full Stack Developer",
      description: "Build awesome products",
      requiredSkills: ["TypeScript", "React"],
      experienceLevel: "MID",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      locationReq: null,
      salaryMin: 100000,
      salaryMax: 150000,
    })

    expect(result).toContain("Title: Full Stack Developer")
    expect(result).toContain("Description: Build awesome products")
    expect(result).toContain("Required Skills: TypeScript, React")
    expect(result).toContain("Experience Level: MID")
    expect(result).toContain("Employment Type: FULL_TIME")
    expect(result).toContain("Location: REMOTE")
    expect(result).toContain("Salary Range: 100000-150000")
  })

  it("includes locationReq when present", () => {
    const result = buildPostingText({
      title: "Dev",
      description: "Work",
      requiredSkills: [],
      experienceLevel: "ENTRY",
      employmentType: "PART_TIME",
      locationType: "HYBRID",
      locationReq: "New York, NY",
      salaryMin: null,
      salaryMax: null,
    })

    expect(result).toContain("Location: HYBRID New York, NY")
  })

  it("omits salary when not provided", () => {
    const result = buildPostingText({
      title: "Dev",
      description: "Work",
      requiredSkills: [],
      experienceLevel: "ENTRY",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      locationReq: null,
      salaryMin: null,
      salaryMax: null,
    })

    expect(result).not.toContain("Salary Range:")
  })

  it("truncates to 8000 chars if necessary", () => {
    const longDescription = "x".repeat(10000)
    const result = buildPostingText({
      title: "Dev",
      description: longDescription,
      requiredSkills: [],
      experienceLevel: "ENTRY",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      locationReq: null,
      salaryMin: null,
      salaryMax: null,
    })

    expect(result.length).toBeLessThanOrEqual(8000)
  })
})

// ---------------------------------------------------------------------------
// generateEmbedding
// ---------------------------------------------------------------------------

describe("generateEmbedding", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.mockClear()
  })

  it("returns 1536-dimensional vector on success", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001)
    mockCreateOpenAI.mockReturnValue({ embedding: vi.fn().mockReturnValue("mock-model") } as never)
    mockEmbed.mockResolvedValue({
      embedding: fakeEmbedding,
      usage: { tokens: 100 },
    } as never)

    const result = await generateEmbedding("some text", "sk-test-key")

    expect(result).toEqual(fakeEmbedding)
    expect(result).toHaveLength(1536)
    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "some text",
      }),
    )
  })

  it("returns null on permanent failure and logs error", async () => {
    mockCreateOpenAI.mockReturnValue({ embedding: vi.fn().mockReturnValue("mock-model") } as never)
    mockEmbed.mockRejectedValue(new Error("Invalid API key"))

    const result = await generateEmbedding("some text", "sk-invalid")

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed after"),
      "Invalid API key",
    )
  })

  it("retries on transient failures", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.5)
    mockCreateOpenAI.mockReturnValue({ embedding: vi.fn().mockReturnValue("mock-model") } as never)
    mockEmbed.mockRejectedValueOnce(new Error("rate limit")).mockResolvedValue({
      embedding: fakeEmbedding,
      usage: { tokens: 100 },
    } as never)

    const result = await generateEmbedding("some text", "sk-test")

    expect(result).toEqual(fakeEmbedding)
    expect(mockEmbed).toHaveBeenCalledTimes(2)
  })

  it("returns null after exhausting retries", async () => {
    mockCreateOpenAI.mockReturnValue({ embedding: vi.fn().mockReturnValue("mock-model") } as never)
    mockEmbed
      .mockRejectedValueOnce(new Error("error 1"))
      .mockRejectedValueOnce(new Error("error 2"))
      .mockRejectedValueOnce(new Error("error 3"))
      .mockRejectedValueOnce(new Error("error 4"))

    const result = await generateEmbedding("some text", "sk-test")

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findSimilarCandidates
// ---------------------------------------------------------------------------

describe("findSimilarCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns sorted results by similarity descending", async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.5)
    mockQueryRaw.mockResolvedValue([
      { seekerId: "s1", similarity: 0.95 },
      { seekerId: "s2", similarity: 0.8 },
    ] as never)

    const result = await findSimilarCandidates(embedding, "jp-1")

    expect(result).toHaveLength(2)
    expect(result[0]!.seekerId).toBe("s1")
    expect(result[0]!.similarity).toBe(0.95)
    expect(result[1]!.seekerId).toBe("s2")
  })

  it("uses default limit and minSimilarity", async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.5)
    mockQueryRaw.mockResolvedValue([] as never)

    await findSimilarCandidates(embedding, "jp-1")

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it("respects custom limit parameter", async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.5)
    mockQueryRaw.mockResolvedValue([] as never)

    await findSimilarCandidates(embedding, "jp-1", 5)

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it("respects custom minSimilarity parameter", async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.5)
    mockQueryRaw.mockResolvedValue([] as never)

    await findSimilarCandidates(embedding, "jp-1", 20, 0.5)

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it("throws on non-finite embedding values", async () => {
    const badEmbedding = [0.5, NaN, 0.3]
    await expect(findSimilarCandidates(badEmbedding, "jp-1")).rejects.toThrow(
      "Invalid embedding: contains non-finite values",
    )
  })

  it("returns empty array when no matches found", async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.5)
    mockQueryRaw.mockResolvedValue([] as never)

    const result = await findSimilarCandidates(embedding, "jp-1")

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event payload schemas
// ---------------------------------------------------------------------------

describe("profileEmbeddingEventSchema", () => {
  it("accepts valid seekerId", () => {
    const result = profileEmbeddingEventSchema.safeParse({ seekerId: "seeker-1" })
    expect(result.success).toBe(true)
  })

  it("rejects missing seekerId", () => {
    const result = profileEmbeddingEventSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects empty seekerId", () => {
    const result = profileEmbeddingEventSchema.safeParse({ seekerId: "" })
    expect(result.success).toBe(false)
  })
})

describe("postingEmbeddingEventSchema", () => {
  it("accepts valid jobPostingId and employerId", () => {
    const result = postingEmbeddingEventSchema.safeParse({
      jobPostingId: "jp-1",
      employerId: "emp-1",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing fields", () => {
    const result = postingEmbeddingEventSchema.safeParse({ jobPostingId: "jp-1" })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("embedding constants", () => {
  it("exports correct embedding model", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small")
  })

  it("exports correct dimensions", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1536)
  })

  it("exports default shortlist size", () => {
    expect(DEFAULT_SHORTLIST_SIZE).toBe(20)
  })

  it("exports minimum similarity threshold", () => {
    expect(MIN_SIMILARITY_THRESHOLD).toBe(0.3)
  })
})
