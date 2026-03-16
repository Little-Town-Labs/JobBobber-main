/**
 * Zod schemas for all Prisma Json fields.
 *
 * These schemas define the concrete types for the 14 Json/Json[] fields in the
 * Prisma schema, replacing Prisma's opaque `JsonValue` type with validated,
 * narrowly-typed alternatives.
 *
 * Used by:
 * - Prisma client extensions (src/lib/db.ts) to parse Json fields on read
 * - Server code that writes Json fields (validates before storage)
 * - tRPC routers that return models with Json fields
 *
 * @see prisma/schema.prisma for field definitions
 * @see src/lib/conversation-schemas.ts for ConversationMessage (re-exported here)
 * @see src/lib/matching-schemas.ts for MatchEvaluationData (re-exported here)
 */
import { z } from "zod"

// Re-export existing schemas that already define Json field shapes
export { conversationMessageSchema } from "@/lib/conversation-schemas"
export type { ConversationMessage } from "@/lib/conversation-schemas"
export { matchEvaluationDataSchema } from "@/lib/matching-schemas"
export type { MatchEvaluationData } from "@/lib/matching-schemas"

// ---------------------------------------------------------------------------
// JobSeeker Json fields
// ---------------------------------------------------------------------------

/** JobSeeker.experience[] — work history entries */
export const experienceEntrySchema = z
  .object({
    title: z.string(),
    company: z.string(),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
  })
  .passthrough()

export type ExperienceEntry = z.infer<typeof experienceEntrySchema>

/** JobSeeker.education[] — education history entries */
export const educationEntrySchema = z
  .object({
    institution: z.string(),
    degree: z.string(),
    field: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    description: z.string().optional(),
  })
  .passthrough()

export type EducationEntry = z.infer<typeof educationEntrySchema>

/** JobSeeker.profileUrls[] — structured URL objects */
export const profileUrlSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().url(),
})

export type ProfileUrl = z.infer<typeof profileUrlSchema>

/**
 * JobSeeker.parsedResume — AI extraction output from resume upload.
 * Shape matches ExtractionOutputSchema in resume.ts.
 * Uses .passthrough() because AI models may include extra keys.
 */
export const parsedResumeSchema = z
  .object({
    headline: z.string().max(255).optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(experienceEntrySchema).optional(),
    education: z.array(educationEntrySchema).optional(),
    bio: z.string().max(2000).optional(),
    location: z.string().max(255).optional(),
  })
  .passthrough()

export type ParsedResume = z.infer<typeof parsedResumeSchema>

// ---------------------------------------------------------------------------
// SeekerSettings / Employer Json fields
// ---------------------------------------------------------------------------

/** SeekerSettings.notifPrefs and Employer.notifPrefs */
export const notifPrefsSchema = z.object({
  matchCreated: z.boolean().default(true),
  mutualAccept: z.boolean().default(true),
})

export type NotifPrefs = z.infer<typeof notifPrefsSchema>

export const NOTIF_PREFS_DEFAULTS: NotifPrefs = { matchCreated: true, mutualAccept: true }

/** SeekerSettings.salaryRules — freeform negotiation rules */
export const salaryRulesSchema = z.record(z.string(), z.unknown())

export type SalaryRules = z.infer<typeof salaryRulesSchema>

/** Employer.urls — company social/career URLs */
export const employerUrlsSchema = z.record(z.string(), z.unknown())

export type EmployerUrls = z.infer<typeof employerUrlsSchema>

// ---------------------------------------------------------------------------
// JobSettings Json fields
// ---------------------------------------------------------------------------

/** JobSettings.minQualOverride — override minimum qualifications */
export const minQualOverrideSchema = z.record(z.string(), z.unknown())

export type MinQualOverride = z.infer<typeof minQualOverrideSchema>

// ---------------------------------------------------------------------------
// Match Json fields
// ---------------------------------------------------------------------------

/** Match.seekerContactInfo — revealed after mutual acceptance */
export const seekerContactInfoSchema = z
  .object({
    name: z.string(),
    email: z.string().optional(),
    location: z.string().nullable().optional(),
  })
  .passthrough()

export type SeekerContactInfo = z.infer<typeof seekerContactInfoSchema>

/** Match.seekerAvailability — availability for interviews */
export const seekerAvailabilitySchema = z
  .object({
    available: z.boolean().optional(),
  })
  .passthrough()

export type SeekerAvailability = z.infer<typeof seekerAvailabilitySchema>

// ---------------------------------------------------------------------------
// ExtractionCache Json fields
// ---------------------------------------------------------------------------

/** ExtractionCache.proposed — same shape as parsedResume */
export const extractionProposedSchema = parsedResumeSchema

export type ExtractionProposed = z.infer<typeof extractionProposedSchema>

// ---------------------------------------------------------------------------
// AuditLog / StripeEvent Json fields
// ---------------------------------------------------------------------------

/** AuditLog.metadata and StripeEvent.payload — generic key-value */
export const auditMetadataSchema = z.record(z.string(), z.unknown())

export type AuditMetadata = z.infer<typeof auditMetadataSchema>

// ---------------------------------------------------------------------------
// Safe parse helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a Json value through a Zod schema, returning the raw value
 * on failure. Prevents runtime crashes from legacy data that doesn't match
 * the current schema.
 */
export function safeParseJson<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  return result.success ? result.data : (value as T)
}

/**
 * Safely parse a Json array through a Zod array schema, returning the raw
 * array on failure.
 */
export function safeParseJsonArray<T>(
  schema: z.ZodType<T>,
  values: unknown[] | undefined | null,
): T[] {
  if (!values || !Array.isArray(values)) return []
  return values.map((v) => safeParseJson(schema, v))
}
