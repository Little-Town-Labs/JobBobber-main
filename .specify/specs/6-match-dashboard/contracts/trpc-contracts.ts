/**
 * Feature 6: Match Dashboard — tRPC Contract Types
 *
 * Extends matches router from Feature 5 with sorting, filtering, and counts.
 * Adds notification procedures and email notification Inngest events.
 */
import { z } from "zod"

// ---------------------------------------------------------------------------
// Extended Match List Input (enhances Feature 5 listForSeeker/listForPosting)
// ---------------------------------------------------------------------------

export const seekerMatchListInput = z
  .object({
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
    sort: z.enum(["confidence", "newest"]).default("confidence"),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .optional()

export const employerMatchListInput = z.object({
  jobPostingId: z.string().min(1),
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
  sort: z.enum(["confidence", "newest"]).default("confidence"),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

// ---------------------------------------------------------------------------
// Match Status Counts
// ---------------------------------------------------------------------------

export const matchCountsOutput = z.object({
  all: z.number(),
  pending: z.number(),
  accepted: z.number(),
  declined: z.number(),
})

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export const notificationPrefsSchema = z.object({
  matchCreated: z.boolean().default(true),
  mutualAccept: z.boolean().default(true),
})

export const updateNotifPrefsInput = z.object({
  matchCreated: z.boolean().optional(),
  mutualAccept: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Inngest Event Types
// ---------------------------------------------------------------------------

export interface MatchCreatedEvent {
  name: "notification/match.created"
  data: {
    matchId: string
    seekerId: string
    jobPostingId: string
    confidenceScore: "STRONG" | "GOOD" | "POTENTIAL"
  }
}

export interface MutualAcceptEvent {
  name: "notification/mutual.accept"
  data: {
    matchId: string
    seekerId: string
    employerId: string
    jobPostingId: string
  }
}
