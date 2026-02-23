import { z } from "zod"
import { createTRPCRouter, publicProcedure, employerProcedure } from "@/server/api/trpc"

/**
 * Job postings router — CRUD for employer postings and seeker discovery.
 * TODO: implement in Feature 4 (job posting management + search).
 */
export const jobPostingsRouter = createTRPCRouter({
  /** List active job postings (public discovery). TODO: implement in Feature 4 */
  list: publicProcedure
    .input(
      z
        .object({
          cursor: z.string().cuid().optional(),
          limit: z.number().int().min(1).max(100).default(20),
          experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]).optional(),
          locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
        })
        .optional(),
    )
    .query(() => {
      return { items: [], nextCursor: null, hasMore: false }
    }),

  /** Get a single posting by id (public). TODO: implement in Feature 4 */
  getById: publicProcedure.input(z.object({ id: z.string().cuid() })).query(() => {
    return null
  }),

  /** Create a new job posting (employer only). TODO: implement in Feature 4 */
  create: employerProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]),
        employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
        locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
        requiredSkills: z.array(z.string()),
      }),
    )
    .mutation(() => {
      return null
    }),

  /** Publish a draft posting (employer only). TODO: implement in Feature 4 */
  publish: employerProcedure.input(z.object({ id: z.string().cuid() })).mutation(() => {
    return null
  }),
})
