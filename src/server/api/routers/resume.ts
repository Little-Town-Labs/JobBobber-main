// Not part of the public REST API — internal AI resume extraction pipeline, UI-only router.
import "server-only"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createTRPCRouter, seekerProcedure } from "@/server/api/trpc"
import { Prisma } from "@prisma/client"
import { decrypt } from "@/lib/encryption"
import { computeProfileCompleteness } from "@/lib/profile-completeness"
import { toFullProfile } from "@/server/api/helpers/profile-mapper"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESUME_BYTES = 10_485_760 // 10 MiB
const BLOB_HOSTNAME = process.env["BLOB_STORE_HOSTNAME"] ?? "blob.vercel-storage.com"
const EXTRACTION_TTL_MS = 15 * 60 * 1000 // 15 minutes

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const GetUploadUrlInput = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  sizeBytes: z.number().int().min(1),
})

const ConfirmUploadInput = z.object({
  blobUrl: z.string().url(),
})

const TriggerExtractionInput = z.object({
  blobUrl: z.string().url(),
})

const ApplyExtractionInput = z.object({
  extractionId: z.string().min(1),
  applyHeadline: z.boolean().default(false),
  applyExperience: z.boolean().default(false),
  applyEducation: z.boolean().default(false),
  applySkills: z.boolean().default(false),
  /** When true, unions extracted skills with existing skills (capped at 50). */
  mergeSkills: z.boolean().default(false),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitise a filename for use in a blob path — strips path separators and control characters. */
function sanitiseFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, "-")
    .replace(/\.\./g, "-")
    .replace(/[^\w\-. ]/g, "")
    .slice(0, 100)
}

/** Build a resolved AI model instance from provider name + decrypted key. */
function buildModel(provider: string, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey }).chat("gpt-4o-mini")
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })("claude-3-haiku-20240307")
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported AI provider: ${provider}`,
  })
}

/** Sanitise an error message to remove API keys and stack traces. */
function sanitiseErrorMessage(err: unknown, apiKey: string): string {
  let msg = err instanceof Error ? err.message : "Extraction failed"
  // Remove any occurrence of the API key from the message
  if (apiKey) {
    msg = msg.split(apiKey).join("[REDACTED]")
  }
  // Strip stack trace lines
  msg = msg.replace(/\n\s+at .+/g, "")
  // Trim and cap length
  return msg.slice(0, 200)
}

// ---------------------------------------------------------------------------
// AI extraction schema
// ---------------------------------------------------------------------------

const ExtractionOutputSchema = z.object({
  headline: z.string().max(255).optional(),
  skills: z.array(z.string()).optional(),
  experience: z.array(z.record(z.string(), z.unknown())).optional(),
  education: z.array(z.record(z.string(), z.unknown())).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(255).optional(),
})

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const resumeRouter = createTRPCRouter({
  /**
   * Returns a blob path and a pre-signed upload URL for direct browser upload.
   * Validates MIME type and file size before issuing any URL.
   * The client uses the returned uploadUrl to PUT the file directly to Vercel Blob.
   * After upload, the client calls resume.confirmUpload to persist the blob URL.
   */
  getUploadUrl: seekerProcedure.input(GetUploadUrlInput).mutation(async ({ ctx, input }) => {
    // Validate file size (mimeType is already enforced by Zod enum)
    if (input.sizeBytes > MAX_RESUME_BYTES) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "File exceeds the 10 MiB limit.",
      })
    }

    const safe = sanitiseFilename(input.filename)
    const timestamp = Date.now()
    const blobPath = `resumes/${ctx.seeker.id}/${timestamp}-${safe}`
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

    // Upload is handled via /api/resume/upload route which uses Vercel Blob's
    // handleUpload pattern (never exposes BLOB_READ_WRITE_TOKEN to the client).
    // This procedure only validates and returns the intended blob path.
    return { blobPath, expiresAt }
  }),

  /**
   * Persists the Vercel Blob URL on the JobSeeker row after a direct upload.
   * Validates that the URL belongs to the configured Blob hostname.
   * Clears parsedResume (stale after new upload) and recomputes completeness.
   */
  confirmUpload: seekerProcedure.input(ConfirmUploadInput).mutation(async ({ ctx, input }) => {
    // Validate blob URL hostname
    let urlHostname: string
    try {
      urlHostname = new URL(input.blobUrl).hostname
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid blob URL." })
    }

    if (urlHostname !== BLOB_HOSTNAME) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Blob URL must be hosted on the configured storage provider.",
      })
    }

    const updatedSeeker = {
      ...ctx.seeker,
      resumeUrl: input.blobUrl,
      parsedResume: null as null,
    }
    const profileCompleteness = computeProfileCompleteness({
      name: updatedSeeker.name,
      headline: updatedSeeker.headline,
      bio: updatedSeeker.bio,
      experience: updatedSeeker.experience,
      skills: updatedSeeker.skills,
      education: updatedSeeker.education,
      resumeUrl: input.blobUrl,
      location: updatedSeeker.location,
    })

    const updated = await ctx.db.jobSeeker.update({
      where: { id: ctx.seeker.id },
      data: {
        resumeUrl: input.blobUrl,
        parsedResume: Prisma.JsonNull,
        profileCompleteness,
      },
    })

    return toFullProfile(updated)
  }),

  /**
   * Triggers AI-powered resume extraction using the seeker's BYOK key.
   * Reads the encrypted key from SeekerSettings, decrypts it, and calls the AI provider.
   * Stores the proposed extraction values in ExtractionCache for user review.
   * Returns ResumeExtractionResult — does NOT write to the JobSeeker row directly.
   */
  triggerExtraction: seekerProcedure
    .input(TriggerExtractionInput)
    .mutation(async ({ ctx, input }) => {
      // Require BYOK key
      const settings = await ctx.db.seekerSettings.findFirst({
        where: { seekerId: ctx.seeker.id },
        select: { byokApiKeyEncrypted: true, byokProvider: true },
      })

      if (!settings?.byokApiKeyEncrypted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI extraction requires an API key. Configure one in Settings.",
        })
      }

      // Validate blobUrl matches stored resumeUrl
      if (input.blobUrl !== ctx.seeker.resumeUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "blobUrl must match your current resume URL.",
        })
      }

      const provider = settings.byokProvider ?? "openai"
      let apiKey: string
      try {
        apiKey = await decrypt(settings.byokApiKeyEncrypted, ctx.seeker.clerkUserId)
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to read API key.",
        })
      }

      // Fetch resume content server-side — the LLM cannot access URLs directly
      let resumeText: string
      try {
        const response = await fetch(input.blobUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch resume: ${response.status}`)
        }
        const contentType = response.headers.get("content-type") ?? ""
        const buffer = Buffer.from(await response.arrayBuffer())

        if (contentType.includes("pdf")) {
          const { PDFParse } = await import("pdf-parse")
          const parser = new PDFParse({ data: new Uint8Array(buffer) })
          const result = await parser.getText()
          resumeText = result.text
        } else {
          const mammoth = await import("mammoth")
          const result = await mammoth.extractRawText({ buffer })
          resumeText = result.value
        }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to read resume file content.",
        })
      }

      // Attempt extraction
      try {
        const model = buildModel(provider, apiKey)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)

        const { object } = await generateObject({
          model,
          schema: ExtractionOutputSchema,
          prompt: `Extract structured profile information from this resume:\n\n${resumeText}`,
          maxOutputTokens: 2000,
          abortSignal: controller.signal,
        })

        clearTimeout(timeout)

        const cache = await ctx.db.extractionCache.create({
          data: {
            seekerId: ctx.seeker.id,
            proposed: object as unknown as Prisma.InputJsonValue, // Zod output not assignable to Prisma's restrictive InputJsonValue
            expiresAt: new Date(Date.now() + EXTRACTION_TTL_MS),
          },
        })

        return {
          extractionId: cache.id,
          proposed: object,
          success: true as const,
        }
      } catch (err) {
        const errorReason = sanitiseErrorMessage(err, apiKey)
        return {
          extractionId: "",
          proposed: {},
          success: false as const,
          errorReason,
        }
      }
    }),

  /**
   * Applies user-approved sections from an ExtractionCache row to the JobSeeker profile.
   * Each section flag (applyHeadline, applyExperience, etc.) must be explicitly true.
   * Deletes the ExtractionCache row after successful application.
   */
  applyExtraction: seekerProcedure.input(ApplyExtractionInput).mutation(async ({ ctx, input }) => {
    const now = new Date()
    // Include seekerId in WHERE to prevent timing-based enumeration of other users' cache IDs
    const cache = await ctx.db.extractionCache.findFirst({
      where: { id: input.extractionId, seekerId: ctx.seeker.id },
    })

    if (!cache || cache.expiresAt < now) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Extraction result not found or has expired.",
      })
    }

    const proposed = cache.proposed as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (input.applyHeadline && proposed["headline"] !== undefined) {
      data.headline = proposed["headline"]
    }
    if (input.applyExperience && proposed["experience"] !== undefined) {
      data.experience = proposed["experience"]
    }
    if (input.applyEducation && proposed["education"] !== undefined) {
      data.education = proposed["education"]
    }

    if (input.mergeSkills && proposed["skills"] !== undefined) {
      const extracted = proposed["skills"] as string[]
      const merged = Array.from(new Set([...ctx.seeker.skills, ...extracted]))
      data.skills = merged.slice(0, 50)
    } else if (input.applySkills && proposed["skills"] !== undefined) {
      data.skills = proposed["skills"]
    }

    // Narrowing Record<string, unknown> fields for completeness computation
    const merged = {
      name: ctx.seeker.name,
      headline: (data.headline as string | null | undefined) ?? ctx.seeker.headline,
      bio: ctx.seeker.bio,
      experience: (data.experience as unknown[]) ?? ctx.seeker.experience,
      skills: (data.skills as string[]) ?? ctx.seeker.skills,
      education: (data.education as unknown[]) ?? ctx.seeker.education,
      resumeUrl: ctx.seeker.resumeUrl,
      location: ctx.seeker.location,
    }
    data.profileCompleteness = computeProfileCompleteness(merged)

    const updated = await ctx.db.jobSeeker.update({
      where: { id: ctx.seeker.id },
      data,
    })

    // Delete extraction cache after successful application
    await ctx.db.extractionCache.delete({ where: { id: input.extractionId } })

    return toFullProfile(updated)
  }),
})
