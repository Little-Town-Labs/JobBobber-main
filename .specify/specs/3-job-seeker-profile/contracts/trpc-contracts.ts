/**
 * tRPC API Contracts — Feature 3: Job Seeker Profile
 *
 * This file is a DESIGN ARTIFACT, not a runnable module.
 * It defines every Zod input schema, output type, and procedure signature
 * that implementers must produce in:
 *
 *   src/server/api/routers/jobSeekers.ts   (jobSeekersRouter)
 *   src/server/api/routers/resume.ts       (resumeRouter)   ← new file
 *   src/app/api/resume/upload/route.ts     (Next.js Route Handler)  ← new file
 *
 * Root router (src/server/api/root.ts) must add:
 *   resume: resumeRouter
 *
 * Feature Flag: SEEKER_PROFILE gates profile creation UI.
 *               Procedures themselves do not check this flag —
 *               the flag controls frontend navigation only.
 *
 * Date: 2026-02-24
 * Spec: .specify/specs/3-job-seeker-profile/spec.md
 */

import { z } from "zod"

// =============================================================================
// SHARED PRIMITIVE SCHEMAS
// =============================================================================

/**
 * A single work experience entry stored in JobSeeker.experience (Json[]).
 * The AI extraction result and the manual form both write this shape.
 * Validated with Zod on every write before being persisted.
 */
export const ExperienceEntrySchema = z.object({
  /** Internal client-side id — cuid generated client-side for list keying.
   *  Not a DB primary key; used to correlate edits across form state and
   *  extraction result review. */
  id: z.string().cuid(),
  jobTitle: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  /** ISO 8601 date string: YYYY-MM or YYYY-MM-DD */
  startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/),
  /** ISO 8601 date string OR the literal string "present" */
  endDate: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/), z.literal("present")]),
  description: z.string().max(2000).optional(),
})

export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>

/**
 * A single education entry stored in JobSeeker.education (Json[]).
 */
export const EducationEntrySchema = z.object({
  id: z.string().cuid(),
  institution: z.string().min(1).max(255),
  degree: z.string().min(1).max(255),
  fieldOfStudy: z.string().max(255).optional(),
  /** ISO 8601 date string: YYYY-MM or YYYY-MM-DD */
  startDate: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/)
    .optional(),
  /** ISO 8601 date string OR "present" */
  endDate: z
    .union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/), z.literal("present")])
    .optional(),
  description: z.string().max(1000).optional(),
})

export type EducationEntry = z.infer<typeof EducationEntrySchema>

/**
 * Relocation preference — maps to JobSeeker.relocationPreference (String?).
 * Using a string enum rather than a Prisma enum because the DB column is plain
 * String — no migration required when values are added in future features.
 */
export const RelocationPreferenceSchema = z.enum([
  "NOT_OPEN",
  "DOMESTIC",
  "INTERNATIONAL",
  "REMOTE_ONLY",
])

export type RelocationPreference = z.infer<typeof RelocationPreferenceSchema>

// =============================================================================
// OUTPUT SHAPES
// =============================================================================

/**
 * Full profile — returned by jobSeekers.getMe (seekerProcedure).
 * Includes all non-private fields on JobSeeker plus the computed completeness score.
 * Does NOT include SeekerSettings — that is a separate router (settings.*).
 * Does NOT include byokApiKeyEncrypted or any other SeekerSettings fields.
 */
export interface FullJobSeekerProfile {
  id: string
  name: string
  headline: string | null
  bio: string | null
  resumeUrl: string | null
  /** Validated against ExperienceEntrySchema[] on read. */
  experience: ExperienceEntry[]
  /** Validated against EducationEntrySchema[] on read. */
  education: EducationEntry[]
  skills: string[]
  /** Portfolio / professional URLs — each a valid URL string. */
  urls: string[]
  location: string | null
  relocationPreference: RelocationPreference | null
  /** 0–100 float, server-computed on every mutation. Persisted on JobSeeker row. */
  profileCompleteness: number
  isActive: boolean
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * Public profile — returned by jobSeekers.getById (publicProcedure).
 * Omits: resumeUrl (private storage URL), parsedResume JSON, createdAt.
 * The resume URL is omitted because Vercel Blob URLs can be used to download
 * the raw file; public profiles show the parsed/structured data only.
 *
 * INVARIANT: This type must never include fields from SeekerSettings.
 */
export interface PublicJobSeekerProfile {
  id: string
  name: string
  headline: string | null
  bio: string | null
  experience: ExperienceEntry[]
  education: EducationEntry[]
  skills: string[]
  urls: string[]
  location: string | null
  relocationPreference: RelocationPreference | null
  profileCompleteness: number
  isActive: boolean
  updatedAt: string // ISO 8601
}

/**
 * AI extraction result — returned by resume.triggerExtraction.
 * This is a PROPOSED shape for review. The user must explicitly call
 * resume.applyExtraction (or jobSeekers.updateProfile with specific sections)
 * to commit any of these fields to their profile.
 *
 * All fields are optional because extraction may partially succeed.
 */
export interface ResumeExtractionResult {
  /** The extraction task id — passed back to resume.applyExtraction */
  extractionId: string
  /** AI-proposed values; user reviews before saving */
  proposed: {
    headline?: string
    experience?: ExperienceEntry[]
    education?: EducationEntry[]
    skills?: string[]
  }
  /** Whether the extraction completed without errors from the AI provider */
  success: boolean
  /** Human-readable reason when success is false */
  errorReason?: string
}

// =============================================================================
// INPUT SCHEMAS — jobSeekersRouter
// =============================================================================

/**
 * jobSeekers.updateProfile input.
 * Multi-section partial update: every top-level key is optional.
 * When a key is provided its value REPLACES the stored value (no deep merge).
 * Arrays (experience, education, skills, urls) are full-replace, not append.
 *
 * Design note: the existing stub in jobSeekers.ts only covers basic fields.
 * This schema extends it to all mutable sections.
 */
export const UpdateProfileInputSchema = z.object({
  // ── Basic info ──────────────────────────────────────────────────────────────
  name: z.string().min(1).max(255).optional(),
  headline: z.string().max(255).optional(),
  bio: z.string().max(2000).optional(),

  // ── Experience ──────────────────────────────────────────────────────────────
  /** Full replacement of the experience array. Pass the complete list including
   *  unchanged entries — this is not a patch. */
  experience: z.array(ExperienceEntrySchema).optional(),

  // ── Education ───────────────────────────────────────────────────────────────
  education: z.array(EducationEntrySchema).optional(),

  // ── Skills ──────────────────────────────────────────────────────────────────
  /** Min 0 (clearing is allowed), max 50 per spec FR-8. */
  skills: z.array(z.string().min(1).max(100)).min(0).max(50).optional(),

  // ── URLs ────────────────────────────────────────────────────────────────────
  /** Each element must be a valid URL. Max 10 per spec User Story 6. */
  urls: z.array(z.string().url("Each entry must be a valid URL")).max(10).optional(),

  // ── Location ────────────────────────────────────────────────────────────────
  location: z.string().max(255).optional(),
  relocationPreference: RelocationPreferenceSchema.optional(),

  // ── Activation ──────────────────────────────────────────────────────────────
  /** Deactivate / reactivate. Maps to isActive on the JobSeeker row. */
  isActive: z.boolean().optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>

// =============================================================================
// INPUT SCHEMAS — resumeRouter
// =============================================================================

/**
 * resume.getUploadUrl input.
 * The client requests a signed upload URL by declaring the file's content type
 * and byte size. The route handler validates these before issuing the URL.
 */
export const GetUploadUrlInputSchema = z.object({
  /** Accepted MIME types only — enforced before calling Vercel Blob. */
  contentType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  /** File size in bytes — must be <= 10_485_760 (10 MiB). */
  fileSizeBytes: z.number().int().min(1).max(10_485_760),
  /** Original client filename — used to construct the Blob path and for display.
   *  Sanitised server-side before being passed to Vercel Blob. */
  filename: z.string().min(1).max(255),
})

export type GetUploadUrlInput = z.infer<typeof GetUploadUrlInputSchema>

/**
 * resume.confirmUpload input.
 * After the client has PUT the file directly to Vercel Blob using the signed URL,
 * it calls this procedure to persist the blob URL on the JobSeeker row.
 */
export const ConfirmUploadInputSchema = z.object({
  /** The public (or private) Vercel Blob URL returned by the client-side upload.
   *  Validated: must start with the configured Vercel Blob hostname to prevent
   *  open-redirect / foreign URL injection. */
  blobUrl: z.string().url(),
})

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>

/**
 * resume.triggerExtraction input.
 * The client triggers AI extraction after confirming an upload.
 * The procedure reads the BYOK key from SeekerSettings internally —
 * the key is never accepted as an input parameter.
 */
export const TriggerExtractionInputSchema = z.object({
  /** The Vercel Blob URL of the resume to extract from.
   *  Must match the authenticated seeker's stored resumeUrl. */
  blobUrl: z.string().url(),
})

export type TriggerExtractionInput = z.infer<typeof TriggerExtractionInputSchema>

/**
 * resume.applyExtraction input.
 * The user has reviewed the AI extraction result and selects which sections
 * to commit. Each section key is a boolean flag ("apply this section").
 * The procedure fetches the extraction result by extractionId and writes only
 * the approved sections to the JobSeeker row.
 *
 * If a user wants to partially edit an extracted section, they should call
 * jobSeekers.updateProfile directly with their edited values — this procedure
 * is a convenience for "accept as-is" flows.
 */
export const ApplyExtractionInputSchema = z.object({
  extractionId: z.string().cuid(),
  /** Which sections to commit from the extraction result. */
  applyHeadline: z.boolean().default(false),
  applyExperience: z.boolean().default(false),
  applyEducation: z.boolean().default(false),
  applySkills: z.boolean().default(false),
  /** When true, appends extracted skills to existing skills rather than replacing.
   *  Capped at 50 total; excess is silently trimmed. */
  mergeSkills: z.boolean().default(false),
})

export type ApplyExtractionInput = z.infer<typeof ApplyExtractionInputSchema>

// =============================================================================
// PROCEDURE SPECIFICATIONS
// =============================================================================

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROUTER: jobSeekersRouter  (src/server/api/routers/jobSeekers.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * jobSeekers.getMe
 *   Type:       query
 *   Procedure:  seekerProcedure
 *   Input:      void
 *   Output:     FullJobSeekerProfile
 *   Notes:
 *     - Identity comes from ctx.seeker (injected by enforceSeeker middleware).
 *     - Returns all mutable fields plus profileCompleteness.
 *     - Does NOT include SeekerSettings fields.
 *     - Parse ctx.seeker.experience and ctx.seeker.education through their
 *       Zod schemas before returning; throw INTERNAL_SERVER_ERROR if stored
 *       JSON is malformed (should never happen after feature ships).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * jobSeekers.getById
 *   Type:       query
 *   Procedure:  publicProcedure
 *   Input:      z.object({ id: z.string().cuid() })
 *   Output:     PublicJobSeekerProfile
 *   Notes:
 *     - Existing stub already has the correct input schema.
 *     - Throws NOT_FOUND if no JobSeeker row exists for the given id.
 *     - Does NOT throw if isActive is false — returns the profile.
 *       The caller (matching system, employer view) decides how to handle
 *       inactive profiles. Only the agent activation system should gate on isActive.
 *     - Explicitly OMITS: resumeUrl, parsedResume, createdAt.
 *     - NEVER queries SeekerSettings in this procedure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * jobSeekers.updateProfile
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      UpdateProfileInputSchema
 *   Output:     FullJobSeekerProfile
 *   Notes:
 *     - Identity from ctx.seeker — never accept a target id in input.
 *     - All top-level keys are optional. An empty object {} is a valid (no-op) call.
 *     - Array fields (experience, education, skills, urls) are FULL REPLACEMENT
 *       when provided. Partial array patching is not supported — the client sends
 *       the complete updated array.
 *     - After writing fields, call computeProfileCompleteness(seeker) to recalculate
 *       the score and persist it in the same Prisma transaction (tx.jobSeeker.update).
 *     - Returns the full FullJobSeekerProfile after the update.
 *     - Validate ExperienceEntrySchema and EducationEntrySchema against each
 *       array element in a .superRefine or .refine:
 *       end date must be chronologically after start date (or "present").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * jobSeekers.setActiveStatus
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      z.object({ isActive: z.boolean() })
 *   Output:     { isActive: boolean; updatedAt: string }
 *   Notes:
 *     - Convenience single-field mutation for the deactivate/reactivate flow.
 *       Separated from updateProfile so the UI can expose a prominent toggle
 *       without risking accidental profile overwrites.
 *     - Does NOT recompute profileCompleteness (isActive has no weight).
 *     - Throws CONFLICT if the requested state matches the current state
 *       (idempotent callers should ignore this; it prevents confusing double-taps).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROUTER: resumeRouter  (src/server/api/routers/resume.ts)  ← NEW FILE
 * ─────────────────────────────────────────────────────────────────────────────
 * Register in root.ts as:  resume: resumeRouter
 *
 * resume.getUploadUrl
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      GetUploadUrlInputSchema
 *   Output:     { uploadUrl: string; blobPath: string; expiresAt: string }
 *   Notes:
 *     - Calls Vercel Blob handleUpload() server-side to generate a client token
 *       that allows a direct PUT from the browser.
 *     - blobPath is the server-assigned path (not user-controlled).
 *       Format: resumes/{seekerId}/{timestamp}-{sanitizedFilename}
 *     - expiresAt is the ISO 8601 expiry of the signed URL (typically 30 min).
 *     - Does NOT store the blobUrl yet — the client calls resume.confirmUpload
 *       after the actual file transfer completes.
 *     - Sanitise filename: strip path separators, keep only alphanumeric, dash,
 *       underscore, and dot characters.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * resume.confirmUpload
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      ConfirmUploadInputSchema
 *   Output:     FullJobSeekerProfile
 *   Notes:
 *     - Validates that blobUrl belongs to the project's Vercel Blob store
 *       (check hostname against process.env.BLOB_STORE_HOSTNAME).
 *       Throw BAD_REQUEST if the URL is for a foreign host.
 *     - Sets JobSeeker.resumeUrl = blobUrl.
 *     - Clears JobSeeker.parsedResume = null (new upload invalidates prior parse).
 *     - Recomputes and persists profileCompleteness.
 *     - Returns FullJobSeekerProfile so the client can immediately reflect the
 *       updated resumeUrl without a separate getMe call.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * resume.triggerExtraction
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      TriggerExtractionInputSchema
 *   Output:     ResumeExtractionResult
 *   Notes:
 *     - PRECONDITION: SeekerSettings must have a non-null byokApiKeyEncrypted.
 *       If absent → throw PRECONDITION_FAILED with message:
 *       "AI extraction requires an API key. Configure your key in Settings."
 *     - Validates blobUrl matches ctx.seeker.resumeUrl to prevent extraction
 *       of arbitrary external files. Throw BAD_REQUEST if mismatch.
 *     - Fetch resume content from Vercel Blob (server-side fetch — the file
 *       is in private storage, not publicly accessible).
 *     - Decrypt the BYOK key using src/lib/encryption.decrypt(encrypted, userId).
 *     - Call the AI provider (via Vercel AI SDK streamObject or generateObject)
 *       with the resume content and the extraction Zod schema.
 *     - AI provider model selection:
 *         byokProvider === "openai"     → "gpt-4-turbo"
 *         byokProvider === "anthropic"  → "claude-3-5-sonnet-20241022"
 *     - Wrap AI call in try/catch. On any error:
 *         success: false, errorReason: sanitized message (no stack, no key).
 *     - On success: store the extraction result in a short-lived cache
 *       (e.g., a separate ExtractionCache table or Redis-compatible KV).
 *       Assign an extractionId (cuid) and return it with the proposed fields.
 *       Cache TTL: 15 minutes.
 *     - Do NOT write any extracted values to JobSeeker at this point.
 *       Writing only happens via resume.applyExtraction.
 *     - Enforce 15-second timeout on the AI call (AbortController or SDK option).
 *     - DO NOT log the raw resume content or the decrypted API key anywhere.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * resume.applyExtraction
 *   Type:       mutation
 *   Procedure:  seekerProcedure
 *   Input:      ApplyExtractionInputSchema
 *   Output:     FullJobSeekerProfile
 *   Notes:
 *     - Fetch the cached extraction by extractionId.
 *       Throw NOT_FOUND if expired or non-existent.
 *       Verify that the extraction belongs to ctx.seeker.id — throw FORBIDDEN
 *       if ownership does not match.
 *     - Apply only the sections the user approved (applyHeadline, applyExperience, etc.).
 *     - mergeSkills: if true, union(existing, extracted) capped at 50; otherwise replace.
 *     - After applying, call computeProfileCompleteness and persist.
 *     - Return FullJobSeekerProfile.
 *     - Delete or invalidate the cache entry after successful application
 *       (one-time-use semantics).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// =============================================================================
// PROFILE COMPLETENESS ALGORITHM
// =============================================================================

/**
 * computeProfileCompleteness(seeker: JobSeeker): number
 *
 * Returns a float in [0, 100] representing the profile completeness score.
 * The score is recalculated on every write and stored in JobSeeker.profileCompleteness.
 *
 * Scoring table (total weight = 100):
 *
 *   Field                           Weight   Condition for full score
 *   ──────────────────────────────────────────────────────────────────
 *   name                              15      non-empty string
 *   headline                          15      non-empty string
 *   bio                               10      non-empty string
 *   experience (at least 1 entry)     20      experience.length >= 1
 *   skills (at least 3)               15      skills.length >= 3
 *   education (at least 1 entry)      10      education.length >= 1
 *   location                           5      non-empty string
 *   resumeUrl                         10      non-null
 *   ──────────────────────────────────────────────────────────────────
 *   Total                            100
 *
 * Agent activation threshold: score >= 70 (inclusive).
 *
 * This function lives in src/lib/profile-completeness.ts and is imported
 * by both jobSeekersRouter and resumeRouter.
 */
export type ComputeProfileCompleteness = (seeker: {
  name: string
  headline: string | null
  bio: string | null
  experience: unknown[]
  skills: string[]
  education: unknown[]
  location: string | null
  resumeUrl: string | null
}) => number

// =============================================================================
// RESUME UPLOAD: ROUTE HANDLER RECOMMENDATION
// =============================================================================

/**
 * DECISION: Resume upload uses a DEDICATED Next.js Route Handler, NOT tRPC.
 *
 * File: src/app/api/resume/upload/route.ts
 *
 * RATIONALE:
 *
 * 1. Vercel Blob requires handleUpload() to run in a Next.js Route Handler.
 *    The handleUpload() function from "@vercel/blob/client" manages the
 *    client-token exchange protocol via POST body streaming. tRPC's JSON body
 *    parsing (via Zod + superjson) would consume the request body before
 *    handleUpload() can access it, breaking the Vercel Blob handshake.
 *
 * 2. File uploads should not pass through tRPC's JSON codec at all.
 *    multipart/form-data and binary streams require raw request access that
 *    is outside the tRPC request lifecycle.
 *
 * 3. Vercel Blob's client-side upload pattern (browser → Blob store directly)
 *    requires a server endpoint that issues a client token and handles the
 *    onUploadCompleted callback — both are handled by handleUpload().
 *
 * RECOMMENDED PATTERN (client token + direct upload):
 *
 *   Client                              Server                     Vercel Blob
 *   ──────                              ──────                     ───────────
 *   1. POST /api/resume/upload         → handleUpload() issues token
 *                                      ← { clientToken }
 *   2. PUT {blobUrl}  (with clientToken) ──────────────────────→ file stored
 *   3. onUploadCompleted callback      → handler verifies auth,
 *                                        NOT persisted here (see note)
 *   4. Client calls resume.confirmUpload({ blobUrl }) via tRPC
 *                                      → seekerProcedure persists resumeUrl
 *
 * AUTHENTICATION in the Route Handler:
 *   The handleUpload() onBeforeGenerateToken callback must call
 *   auth() from @clerk/nextjs/server and verify the userId matches
 *   an active JobSeeker row before issuing a token.
 *   Throw an Error (not TRPCError) to reject — handleUpload() translates
 *   this to a 403 response.
 *
 * IMPORTANT: The route handler should NOT update JobSeeker.resumeUrl directly
 * in onUploadCompleted, because that callback runs asynchronously after the
 * browser upload and cannot be awaited by the client. Instead, the client
 * explicitly calls resume.confirmUpload after receiving the blobUrl from the
 * Vercel Blob client SDK. This keeps the persistence path synchronous and
 * within the tRPC middleware chain (seekerProcedure, ownership checks, etc.).
 *
 * Route handler type signature:
 *   export async function POST(request: Request): Promise<Response>
 *   // Uses handleUpload() from "@vercel/blob/client"
 */

// =============================================================================
// SECURITY INVARIANTS (enforce in every implementation)
// =============================================================================

/**
 * 1. SeekerSettings is NEVER fetched in jobSeekers.getById (publicProcedure).
 *    The Prisma query must NOT include a settings include/select clause.
 *
 * 2. byokApiKeyEncrypted is NEVER returned in any API response.
 *    It is read internally (resume.triggerExtraction) and immediately decrypted;
 *    it must never appear in a return value.
 *
 * 3. resume.triggerExtraction must sanitise the AI provider error before
 *    setting errorReason. Never include: stack traces, raw model output,
 *    provider error codes, or any substring of the API key.
 *
 * 4. Resume blob URLs must be in PRIVATE Vercel Blob storage.
 *    Use put(..., { access: "public" }) ONLY if you intentionally want
 *    the file publicly downloadable. For resumes, use access: "public"
 *    is acceptable ONLY if the URL itself is treated as a secret
 *    (not returned in public profile responses). See PublicJobSeekerProfile —
 *    resumeUrl is deliberately absent.
 *
 * 5. All mutations enforce ownership via ctx.seeker.id, never via user-supplied id.
 *
 * 6. Cross-user extraction cache access prevented:
 *    verify extractionCache.seekerId === ctx.seeker.id before returning.
 */

// =============================================================================
// ERROR CODE MAP FOR THIS FEATURE
// =============================================================================

/**
 * Procedure                    │ Error Code             │ Condition
 * ─────────────────────────────┼────────────────────────┼──────────────────────────────────────────
 * jobSeekers.getById           │ NOT_FOUND              │ No row for given id
 * jobSeekers.updateProfile     │ BAD_REQUEST            │ Zod validation failure
 * jobSeekers.updateProfile     │ BAD_REQUEST            │ end date before start date
 * jobSeekers.setActiveStatus   │ CONFLICT               │ isActive already equals requested value
 * resume.getUploadUrl          │ BAD_REQUEST            │ Unsupported contentType or fileSizeBytes > 10 MiB
 * resume.confirmUpload         │ BAD_REQUEST            │ blobUrl hostname not in BLOB_STORE_HOSTNAME
 * resume.triggerExtraction     │ PRECONDITION_FAILED    │ No BYOK key stored in SeekerSettings
 * resume.triggerExtraction     │ BAD_REQUEST            │ blobUrl does not match seeker's resumeUrl
 * resume.triggerExtraction     │ INTERNAL_SERVER_ERROR  │ AI provider call failed (log to Sentry)
 * resume.applyExtraction       │ NOT_FOUND              │ extractionId expired or non-existent
 * resume.applyExtraction       │ FORBIDDEN              │ extractionId belongs to a different seeker
 * All seekerProcedures         │ UNAUTHORIZED           │ No Clerk session
 * All seekerProcedures         │ NOT_FOUND              │ No JobSeeker row for userId (from middleware)
 */

// =============================================================================
// ROUTER RESPONSIBILITY SPLIT
// =============================================================================

/**
 * jobSeekersRouter  (src/server/api/routers/jobSeekers.ts)
 * ──────────────────────────────────────────────────────────
 * Procedure             Type      Base Procedure
 * ─────────────────────────────────────────────────
 * getMe                 query     seekerProcedure
 * getById               query     publicProcedure
 * updateProfile         mutation  seekerProcedure
 * setActiveStatus       mutation  seekerProcedure
 *
 * resumeRouter  (src/server/api/routers/resume.ts)  ← NEW FILE
 * ──────────────────────────────────────────────────────────
 * Procedure             Type      Base Procedure
 * ─────────────────────────────────────────────────
 * getUploadUrl          mutation  seekerProcedure
 * confirmUpload         mutation  seekerProcedure
 * triggerExtraction     mutation  seekerProcedure
 * applyExtraction       mutation  seekerProcedure
 *
 * RATIONALE FOR SPLIT:
 * Resume operations form a distinct sub-domain with their own lifecycle
 * (upload → confirm → extract → apply). They depend on Vercel Blob and the AI
 * SDK — neither of which belongs in the core profile router. Isolating them
 * makes each file independently testable (mock Blob in resume.test.ts,
 * mock AI SDK in extraction.test.ts, neither needed in jobSeekers.test.ts).
 *
 * Next.js Route Handler  (src/app/api/resume/upload/route.ts)  ← NEW FILE
 * ──────────────────────────────────────────────────────────────────────────
 * Handles the Vercel Blob client-token handshake only.
 * Does NOT persist any data to the DB.
 * Auth enforced via Clerk auth() in onBeforeGenerateToken.
 */
