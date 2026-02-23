import { z } from "zod"
import { createTRPCRouter, seekerProcedure, employerProcedure } from "@/server/api/trpc"

/**
 * Settings router — private negotiation parameters for seekers and employers.
 *
 * PRIVACY INVARIANT: SeekerSettings and JobSettings are NEVER exposed
 * to the other party. These procedures are accessible only by the record owner.
 *
 * NOTE: getSeekerSettings has NO id input — identity comes from ctx.seeker.id.
 * TODO: implement in Feature 5 (BYOK settings + encryption).
 */
export const settingsRouter = createTRPCRouter({
  /** Get the seeker's private settings. No id param — uses ctx.seeker identity. */
  getSeekerSettings: seekerProcedure.query(() => {
    // TODO: implement in Feature 5 (decrypt BYOK key if present)
    return null
  }),

  /** Update the seeker's private settings. TODO: implement in Feature 5 */
  updateSeekerSettings: seekerProcedure
    .input(
      z.object({
        minSalary: z.number().int().min(0).optional(),
        dealBreakers: z.array(z.string()).optional(),
        priorities: z.array(z.string()).optional(),
        customPrompt: z.string().max(2000).optional(),
      }),
    )
    .mutation(() => {
      return null
    }),

  /** Get private settings for a specific job posting. TODO: implement in Feature 5 */
  getJobSettings: employerProcedure
    .input(z.object({ jobPostingId: z.string().cuid() }))
    .query(() => {
      return null
    }),

  /** Update private settings for a job posting. TODO: implement in Feature 5 */
  updateJobSettings: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().cuid(),
        trueMaxSalary: z.number().int().min(0).optional(),
        urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        priorityAttrs: z.array(z.string()).optional(),
        customPrompt: z.string().max(2000).optional(),
      }),
    )
    .mutation(() => {
      return null
    }),
})
