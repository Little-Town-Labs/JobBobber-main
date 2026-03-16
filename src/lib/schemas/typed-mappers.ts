/**
 * Typed model mappers for Prisma Json fields.
 *
 * These functions parse Prisma's opaque JsonValue fields into concrete types
 * using the Zod schemas from prisma-json.ts. Use at consumption boundaries
 * (tRPC routers, Inngest functions) to get typed data from raw Prisma results.
 *
 * Uses safeParse with fallback — never throws on legacy data.
 */
import type { JsonValue } from "@prisma/client/runtime/library"
import {
  experienceEntrySchema,
  educationEntrySchema,
  profileUrlSchema,
  parsedResumeSchema,
  notifPrefsSchema,
  seekerContactInfoSchema,
  seekerAvailabilitySchema,
  safeParseJson,
  safeParseJsonArray,
  NOTIF_PREFS_DEFAULTS,
  type ExperienceEntry,
  type EducationEntry,
  type ProfileUrl,
  type ParsedResume,
  type NotifPrefs,
  type SeekerContactInfo,
  type SeekerAvailability,
} from "./prisma-json"
import { matchEvaluationDataSchema, type MatchEvaluationData } from "@/lib/matching-schemas"

// ---------------------------------------------------------------------------
// JobSeeker field parsers
// ---------------------------------------------------------------------------

export function parseExperience(raw: JsonValue[] | undefined | null): ExperienceEntry[] {
  return safeParseJsonArray(experienceEntrySchema, raw)
}

export function parseEducation(raw: JsonValue[] | undefined | null): EducationEntry[] {
  return safeParseJsonArray(educationEntrySchema, raw)
}

export function parseProfileUrls(raw: JsonValue[] | undefined | null): ProfileUrl[] {
  return safeParseJsonArray(profileUrlSchema, raw)
}

export function parseParsedResume(raw: JsonValue | null): ParsedResume | null {
  if (raw === null) return null
  return safeParseJson(parsedResumeSchema, raw)
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export function parseNotifPrefs(raw: unknown): NotifPrefs {
  if (!raw || typeof raw !== "object") return NOTIF_PREFS_DEFAULTS
  return safeParseJson(notifPrefsSchema, raw)
}

// ---------------------------------------------------------------------------
// Match field parsers
// ---------------------------------------------------------------------------

export function parseSeekerContactInfo(raw: JsonValue | null): SeekerContactInfo | null {
  if (raw === null) return null
  return safeParseJson(seekerContactInfoSchema, raw)
}

export function parseSeekerAvailability(raw: JsonValue | null): SeekerAvailability | null {
  if (raw === null) return null
  return safeParseJson(seekerAvailabilitySchema, raw)
}

export function parseEvaluationData(raw: JsonValue | null): MatchEvaluationData | null {
  if (raw === null) return null
  return safeParseJson(matchEvaluationDataSchema, raw)
}
