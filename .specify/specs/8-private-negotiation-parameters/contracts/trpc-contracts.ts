/**
 * Feature 8: Private Negotiation Parameters — tRPC Contract Definitions
 *
 * These type-level contracts define the expected input/output shapes
 * for the settings router procedures. Implementation in settings.ts
 * must conform to these contracts.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

/** String array with max items and max chars per item */
const boundedStringArray = (maxItems: number, maxChars: number) =>
  z.array(z.string().max(maxChars)).max(maxItems)

// ---------------------------------------------------------------------------
// Seeker Settings
// ---------------------------------------------------------------------------

export const updateSeekerSettingsInput = z.object({
  minSalary: z.number().int().min(0).optional(),
  salaryRules: z.record(z.unknown()).optional(),
  dealBreakers: boundedStringArray(20, 200).optional(),
  priorities: boundedStringArray(20, 200).optional(),
  exclusions: boundedStringArray(20, 200).optional(),
  customPrompt: z.string().max(2000).optional(),
})

export type UpdateSeekerSettingsInput = z.infer<typeof updateSeekerSettingsInput>

/** getSeekerSettings has NO input — identity from ctx.seeker.id */
export type GetSeekerSettingsOutput = {
  id: string
  minSalary: number | null
  salaryRules: Record<string, unknown>
  dealBreakers: string[]
  priorities: string[]
  exclusions: string[]
  customPrompt: string | null
} | null

// ---------------------------------------------------------------------------
// Job Settings
// ---------------------------------------------------------------------------

export const updateJobSettingsInput = z.object({
  jobPostingId: z.string().cuid(),
  trueMaxSalary: z.number().int().min(0).optional(),
  minQualOverride: z.record(z.unknown()).optional(),
  willingToTrain: boundedStringArray(20, 200).optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  priorityAttrs: boundedStringArray(10, 200).optional(),
  customPrompt: z.string().max(2000).optional(),
})

export type UpdateJobSettingsInput = z.infer<typeof updateJobSettingsInput>

export const getJobSettingsInput = z.object({
  jobPostingId: z.string().cuid(),
})

export type GetJobSettingsOutput = {
  id: string
  trueMaxSalary: number | null
  minQualOverride: Record<string, unknown> | null
  willingToTrain: string[]
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  priorityAttrs: string[]
  customPrompt: string | null
} | null
