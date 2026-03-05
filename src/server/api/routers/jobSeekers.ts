import { z } from "zod"
import { createTRPCRouter, publicProcedure, seekerProcedure } from "@/server/api/trpc"

/**
 * Job seeker router — profile management and discovery.
 * TODO: implement procedures in Feature 2 (seeker onboarding + profile).
 */
export const jobSeekersRouter = createTRPCRouter({
  /** Get the authenticated seeker's own profile. TODO: implement in Feature 2 */
  getMe: seekerProcedure.query(() => {
    return null
  }),

  /** Get a public seeker profile by id. TODO: implement in Feature 2 */
  getById: publicProcedure.input(z.object({ id: z.string().cuid() })).query(() => {
    return null
  }),

  /** Update the authenticated seeker's profile. TODO: implement in Feature 2 */
  updateProfile: seekerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        headline: z.string().max(255).optional(),
        bio: z.string().max(2000).optional(),
        skills: z.array(z.string()).optional(),
        location: z.string().optional(),
      }),
    )
    .mutation(() => {
      return null
    }),
})
