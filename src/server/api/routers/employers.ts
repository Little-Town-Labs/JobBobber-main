import { z } from "zod"
import { createTRPCRouter, employerProcedure, adminProcedure } from "@/server/api/trpc"

/**
 * Employer router — organisation profile and member management.
 * TODO: implement in Feature 3 (employer onboarding + org management).
 */
export const employersRouter = createTRPCRouter({
  /** Get the current employer's org profile. TODO: implement in Feature 3 */
  getMe: employerProcedure.query(() => {
    return null
  }),

  /** Update the employer's org profile. TODO: implement in Feature 3 */
  updateProfile: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        industry: z.string().optional(),
        culture: z.string().optional(),
      }),
    )
    .mutation(() => {
      return null
    }),

  /** List members of the current org. TODO: implement in Feature 3 */
  listMembers: adminProcedure.query(() => {
    return []
  }),
})
