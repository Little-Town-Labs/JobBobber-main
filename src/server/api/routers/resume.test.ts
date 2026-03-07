/**
 * Task 2.3 — resume router unit tests
 *
 * Prisma client, Vercel Blob, and AI SDK are mocked — no live services.
 * Tests FAIL before resume.ts exists (module not found).
 *
 * Procedures tested:
 *   getUploadUrl, confirmUpload, triggerExtraction, applyExtraction
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

const mockEncrypt = vi.fn()
const mockDecrypt = vi.fn()
vi.mock("@/lib/encryption", () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}))

const mockJobSeekerFindUnique = vi.fn()
const mockJobSeekerUpdate = vi.fn()
const mockExtractionCacheCreate = vi.fn()
const mockExtractionCacheFindFirst = vi.fn()
const mockExtractionCacheDelete = vi.fn()
const mockSeekerSettingsFindFirst = vi.fn()

const mockDb = {
  jobSeeker: {
    findUnique: mockJobSeekerFindUnique,
    update: mockJobSeekerUpdate,
  },
  seekerSettings: { findFirst: mockSeekerSettingsFindFirst },
  extractionCache: {
    create: mockExtractionCacheCreate,
    findFirst: mockExtractionCacheFindFirst,
    delete: mockExtractionCacheDelete,
  },
  employer: { findUnique: vi.fn() },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const mockGenerateObject = vi.fn()
vi.mock("ai", () => ({ generateObject: mockGenerateObject }))
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn(() => "openai-model"),
  })),
}))
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => "anthropic-model")),
}))

// Mock fetch for resume content fetching in triggerExtraction
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Stub process.env for blob hostname validation
const BLOB_HOSTNAME = "blob.vercel-storage.com"
vi.stubEnv("BLOB_STORE_HOSTNAME", BLOB_HOSTNAME)
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test")

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEEKER = {
  id: "cld_seeker_01",
  clerkUserId: "user_clerk_01",
  name: "Jane Doe",
  headline: "Senior Engineer",
  bio: "10 years experience",
  resumeUrl: `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/resume.pdf`,
  parsedResume: null,
  experience: [],
  education: [],
  skills: ["TypeScript", "React", "Node.js"],
  urls: [],
  profileUrls: [],
  location: "Austin, TX",
  relocationPreference: null,
  profileCompleteness: 80,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const SEEKER_SETTINGS = {
  id: "settings_01",
  seekerId: SEEKER.id,
  byokApiKeyEncrypted: "encrypted_key",
  byokProvider: "openai",
  byokMaskedKey: "sk-...abcd",
  byokKeyValidatedAt: new Date(),
  minSalary: null,
  salaryRules: {},
  dealBreakers: [],
  priorities: [],
  exclusions: [],
  customPrompt: null,
  notifPrefs: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

const EXTRACTION_CACHE = {
  id: "clx9ab1234567890abcdefghi", // valid CUID1 format
  seekerId: SEEKER.id,
  proposed: {
    headline: "Staff Engineer",
    skills: ["TypeScript", "Rust"],
    experience: [],
    education: [],
    bio: null,
    location: null,
  },
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
  createdAt: new Date(),
}

// ---------------------------------------------------------------------------
// Helper: make a resume caller
// ---------------------------------------------------------------------------

async function makeResumeCaller(ctx: {
  userId?: string | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { resumeRouter } = await import("@/server/api/routers/resume")

  return createCallerFactory(createTRPCRouter({ resume: resumeRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx.userId ?? "user_clerk_01",
    orgId: null,
    orgRole: null,
    userRole: ctx.userRole ?? "JOB_SEEKER",
    hasByokKey: false,
  } as never)
}

// ---------------------------------------------------------------------------
// getUploadUrl
// ---------------------------------------------------------------------------

describe("resume.getUploadUrl", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
  })

  it("returns uploadUrl/blobPath/expiresAt for valid PDF", async () => {
    const caller = await makeResumeCaller({})
    const result = await caller.resume.getUploadUrl({
      filename: "my-resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1_000_000,
    })

    expect(result).toMatchObject({
      blobPath: expect.stringContaining("resumes/"),
      expiresAt: expect.any(String),
    })
  })

  it("returns blobPath/expiresAt for valid DOCX", async () => {
    const caller = await makeResumeCaller({})
    const result = await caller.resume.getUploadUrl({
      filename: "my-resume.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 500_000,
    })

    expect(result).toHaveProperty("blobPath")
  })

  it("throws for unsupported MIME type (image/png)", async () => {
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.getUploadUrl({
        filename: "photo.png",
        mimeType: "image/png" as "application/pdf",
        sizeBytes: 500_000,
      }),
    ).rejects.toThrow()
  })

  it("throws BAD_REQUEST for file exceeding 10 MiB", async () => {
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.getUploadUrl({
        filename: "huge.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10_485_761,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("blobPath follows the expected pattern including seekerId", async () => {
    const caller = await makeResumeCaller({})
    const result = await caller.resume.getUploadUrl({
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1_000_000,
    })

    expect(result.blobPath).toMatch(new RegExp(`^resumes/${SEEKER.id}/\\d+-resume\\.pdf$`))
  })

  it("filename is sanitised (strips path separators)", async () => {
    const caller = await makeResumeCaller({})
    const result = await caller.resume.getUploadUrl({
      filename: "../../etc/passwd",
      mimeType: "application/pdf",
      sizeBytes: 100_000,
    })

    expect(result.blobPath).not.toContain("..")
    expect(result.blobPath).not.toContain("/etc/")
  })
})

// ---------------------------------------------------------------------------
// confirmUpload
// ---------------------------------------------------------------------------

describe("resume.confirmUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    mockJobSeekerUpdate.mockResolvedValue({
      ...SEEKER,
      resumeUrl: `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/new-resume.pdf`,
      parsedResume: null,
      profileCompleteness: 85,
    })
  })

  it("throws BAD_REQUEST if blobUrl hostname does not match BLOB_STORE_HOSTNAME", async () => {
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.confirmUpload({
        blobUrl: "https://evil.com/resumes/cld_seeker_01/resume.pdf",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("sets resumeUrl on the seeker row", async () => {
    const newUrl = `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/new-resume.pdf`
    const caller = await makeResumeCaller({})
    await caller.resume.confirmUpload({ blobUrl: newUrl })

    expect(mockJobSeekerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resumeUrl: newUrl }),
      }),
    )
  })

  it("clears parsedResume to null", async () => {
    const newUrl = `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/new-resume.pdf`
    const caller = await makeResumeCaller({})
    await caller.resume.confirmUpload({ blobUrl: newUrl })

    expect(mockJobSeekerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parsedResume: expect.anything() }),
      }),
    )
  })

  it("persists updated profileCompleteness", async () => {
    const newUrl = `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/new-resume.pdf`
    const caller = await makeResumeCaller({})
    await caller.resume.confirmUpload({ blobUrl: newUrl })

    expect(mockJobSeekerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ profileCompleteness: expect.any(Number) }),
      }),
    )
  })

  it("returns FullJobSeekerProfile", async () => {
    const newUrl = `https://${BLOB_HOSTNAME}/resumes/cld_seeker_01/new-resume.pdf`
    const caller = await makeResumeCaller({})
    const result = await caller.resume.confirmUpload({ blobUrl: newUrl })

    expect(result).toMatchObject({ id: SEEKER.id })
    expect(result).not.toHaveProperty("parsedResume")
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
  })
})

// ---------------------------------------------------------------------------
// triggerExtraction
// ---------------------------------------------------------------------------

// Mock pdf-parse and mammoth for resume content extraction
const mockPdfParseGetText = vi.fn()
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = mockPdfParseGetText
  },
}))
const mockMammoth = { extractRawText: vi.fn() }
vi.mock("mammoth", () => mockMammoth)

describe("resume.triggerExtraction", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    mockSeekerSettingsFindFirst.mockResolvedValue(SEEKER_SETTINGS)
    mockDecrypt.mockResolvedValue("sk-openai-decrypted")
    mockExtractionCacheCreate.mockResolvedValue(EXTRACTION_CACHE)
    // Re-stub fetch and pdf-parse after resetAllMocks clears them
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    })
    vi.stubGlobal("fetch", mockFetch)
    mockPdfParseGetText.mockResolvedValue({ text: "Resume content from PDF" })
  })

  it("throws PRECONDITION_FAILED if SeekerSettings.byokApiKeyEncrypted is null", async () => {
    mockSeekerSettingsFindFirst.mockResolvedValue({
      ...SEEKER_SETTINGS,
      byokApiKeyEncrypted: null,
    })
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.triggerExtraction({ blobUrl: SEEKER.resumeUrl! }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" })
  })

  it("throws BAD_REQUEST if blobUrl does not match ctx.seeker.resumeUrl", async () => {
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.triggerExtraction({
        blobUrl: `https://${BLOB_HOSTNAME}/resumes/other/resume.pdf`,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("on success: creates an ExtractionCache row and returns ResumeExtractionResult with success: true", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        headline: "Staff Engineer",
        skills: ["TypeScript"],
        experience: [],
        education: [],
        bio: null,
        location: null,
      },
    })
    const caller = await makeResumeCaller({})
    const result = await caller.resume.triggerExtraction({ blobUrl: SEEKER.resumeUrl! })

    expect(result).toMatchObject({ success: true })
    expect(mockExtractionCacheCreate).toHaveBeenCalled()
  })

  it("on AI provider error: returns ResumeExtractionResult with success: false and sanitised errorReason", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API quota exceeded"))
    const caller = await makeResumeCaller({})
    const result = await caller.resume.triggerExtraction({ blobUrl: SEEKER.resumeUrl! })

    expect(result).toMatchObject({ success: false })
    expect((result as Record<string, unknown>).errorReason).toBeTruthy()
  })

  it("sanitised errorReason does NOT contain raw API key or stack trace", async () => {
    mockDecrypt.mockResolvedValue("sk-proj-super-secret-key")
    mockGenerateObject.mockRejectedValue(new Error("Auth failed for sk-proj-super-secret-key"))
    const caller = await makeResumeCaller({})
    const result = await caller.resume.triggerExtraction({ blobUrl: SEEKER.resumeUrl! })

    const errorReason = (result as Record<string, unknown>).errorReason as string
    expect(errorReason).not.toContain("sk-proj-super-secret-key")
    expect(errorReason).not.toContain("at ")
  })

  it("does NOT write extraction values to JobSeeker directly", async () => {
    mockGenerateObject.mockResolvedValue({ object: { headline: "Staff Engineer" } })
    const caller = await makeResumeCaller({})
    await caller.resume.triggerExtraction({ blobUrl: SEEKER.resumeUrl! })

    expect(mockJobSeekerUpdate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// applyExtraction
// ---------------------------------------------------------------------------

describe("resume.applyExtraction", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    mockExtractionCacheFindFirst.mockResolvedValue(EXTRACTION_CACHE)
    mockJobSeekerUpdate.mockResolvedValue({ ...SEEKER, headline: "Staff Engineer" })
    mockExtractionCacheDelete.mockResolvedValue(EXTRACTION_CACHE)
  })

  it("throws NOT_FOUND if extractionId does not exist", async () => {
    mockExtractionCacheFindFirst.mockResolvedValue(null)
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.applyExtraction({ extractionId: "clxnonexistent0000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws NOT_FOUND if extraction has expired", async () => {
    mockExtractionCacheFindFirst.mockResolvedValue({
      ...EXTRACTION_CACHE,
      expiresAt: new Date(Date.now() - 1000), // already expired
    })
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.applyExtraction({ extractionId: "clx9ab1234567890abcdefghi" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws NOT_FOUND if extractionCache.seekerId does not match ctx.seeker.id (query scoped by seekerId)", async () => {
    // With seekerId in the WHERE clause, a mismatch returns null → NOT_FOUND
    // This prevents timing-based enumeration of other users' cache IDs
    mockExtractionCacheFindFirst.mockResolvedValue(null)
    const caller = await makeResumeCaller({})
    await expect(
      caller.resume.applyExtraction({ extractionId: "clx9ab1234567890abcdefghi" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("with applyHeadline: true — sets headline on the seeker row", async () => {
    const caller = await makeResumeCaller({})
    await caller.resume.applyExtraction({
      extractionId: "clx9ab1234567890abcdefghi",
      applyHeadline: true,
    })

    expect(mockJobSeekerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ headline: "Staff Engineer" }),
      }),
    )
  })

  it("with applyExperience: true — replaces experience array", async () => {
    const cacheWithExp = {
      ...EXTRACTION_CACHE,
      proposed: { ...EXTRACTION_CACHE.proposed, experience: [{ title: "Engineer" }] },
    }
    mockExtractionCacheFindFirst.mockResolvedValue(cacheWithExp)
    const caller = await makeResumeCaller({})
    await caller.resume.applyExtraction({
      extractionId: "clx9ab1234567890abcdefghi",
      applyExperience: true,
    })

    expect(mockJobSeekerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ experience: [{ title: "Engineer" }] }),
      }),
    )
  })

  it("with mergeSkills: true — unions existing and extracted skills (capped at 50)", async () => {
    mockExtractionCacheFindFirst.mockResolvedValue({
      ...EXTRACTION_CACHE,
      proposed: { ...EXTRACTION_CACHE.proposed, skills: ["Rust", "Go (Golang)"] },
    })
    const caller = await makeResumeCaller({})
    await caller.resume.applyExtraction({
      extractionId: "clx9ab1234567890abcdefghi",
      mergeSkills: true,
    })

    const updateCall = mockJobSeekerUpdate.mock.calls[0]?.[0]
    const updatedSkills = updateCall?.data?.skills as string[]
    expect(updatedSkills).toContain("TypeScript") // existing
    expect(updatedSkills).toContain("Rust") // extracted
    expect(updatedSkills.length).toBeLessThanOrEqual(50)
  })

  it("with mergeSkills: false, applySkills: true — replaces skills", async () => {
    const caller = await makeResumeCaller({})
    await caller.resume.applyExtraction({
      extractionId: "clx9ab1234567890abcdefghi",
      mergeSkills: false,
      applySkills: true,
    })

    const updateCall = mockJobSeekerUpdate.mock.calls[0]?.[0]
    const updatedSkills = updateCall?.data?.skills as string[]
    expect(updatedSkills).toEqual(EXTRACTION_CACHE.proposed.skills)
  })

  it("deletes the ExtractionCache row after successful application", async () => {
    const caller = await makeResumeCaller({})
    await caller.resume.applyExtraction({
      extractionId: "clx9ab1234567890abcdefghi",
      applyHeadline: true,
    })

    expect(mockExtractionCacheDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "clx9ab1234567890abcdefghi" } }),
    )
  })
})
