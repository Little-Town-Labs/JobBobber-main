import { z } from "zod"
import { createTRPCRouter, seekerProcedure, employerProcedure } from "@/server/api/trpc"

/**
 * Matches router — viewing and acting on AI-generated match recommendations.
 * TODO: implement in Feature 7 (match lifecycle).
 *
 * MatchStatus is derived at read-time from seekerStatus + employerStatus.
 * MUTUALLY_ACCEPTED is the only state where seekerContactInfo is non-null.
 *
 * @see contracts/trpc-api.ts (MatchStatus derivation table)
 */
export const matchesRouter = createTRPCRouter({
  /** List matches for the authenticated seeker. TODO: implement in Feature 7 */
  listForSeeker: seekerProcedure
    .input(
      z
        .object({
          cursor: z.string().cuid().optional(),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(() => {
      return { items: [], nextCursor: null, hasMore: false }
    }),

  /** List matches for the authenticated employer. TODO: implement in Feature 7 */
  listForEmployer: employerProcedure
    .input(
      z
        .object({
          cursor: z.string().cuid().optional(),
          limit: z.number().int().min(1).max(100).default(20),
          jobPostingId: z.string().cuid().optional(),
        })
        .optional(),
    )
    .query(() => {
      return { items: [], nextCursor: null, hasMore: false }
    }),

  /** Seeker accepts or declines a match. TODO: implement in Feature 7 */
  seekerRespond: seekerProcedure
    .input(
      z.object({
        matchId: z.string().cuid(),
        decision: z.enum(["ACCEPTED", "DECLINED"]),
      }),
    )
    .mutation(() => {
      return null
    }),

  /** Employer accepts or declines a match. TODO: implement in Feature 7 */
  employerRespond: employerProcedure
    .input(
      z.object({
        matchId: z.string().cuid(),
        decision: z.enum(["ACCEPTED", "DECLINED"]),
      }),
    )
    .mutation(() => {
      return null
    }),
})
