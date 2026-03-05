import "server-only"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, publicProcedure, seekerProcedure } from "@/server/api/trpc"
import { computeProfileCompleteness } from "@/lib/profile-completeness"
import { toFullProfile } from "@/server/api/helpers/profile-mapper"

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const ExperienceEntrySchema = z.object({
  id: z.string().min(1),
  jobTitle: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/),
  endDate: z.union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/), z.literal("present")]),
  description: z.string().max(2000).optional(),
})

const EducationEntrySchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1).max(255),
  degree: z.string().min(1).max(255),
  fieldOfStudy: z.string().max(255).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/)
    .optional(),
  endDate: z
    .union([z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/), z.literal("present")])
    .optional(),
  description: z.string().max(1000).optional(),
})

const ProfileUrlSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  url: z.string().url("Each URL must be a valid URL"),
})

const UpdateProfileInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  headline: z.string().max(255).optional(),
  bio: z.string().max(2000).optional(),
  experience: z.array(ExperienceEntrySchema).optional(),
  education: z.array(EducationEntrySchema).optional(),
  // Max 50 skills per spec FR-8
  skills: z.array(z.string().min(1).max(100)).min(0).max(50).optional(),
  // profileUrls stored as structured objects (max 10); exposed as `urls` in the input
  // to match the contract/frontend expectation. Mapped to `profileUrls` on write.
  urls: z.array(ProfileUrlSchema).max(10).optional(),
  location: z.string().max(255).optional(),
  relocationPreference: z.enum(["NOT_OPEN", "DOMESTIC", "INTERNATIONAL", "REMOTE_ONLY"]).optional(),
})

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/** Explicit field selection for getById — never returns resumeUrl / parsedResume / createdAt */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  headline: true,
  bio: true,
  experience: true,
  education: true,
  skills: true,
  profileUrls: true,
  location: true,
  relocationPreference: true,
  profileCompleteness: true,
  isActive: true,
  updatedAt: true,
} as const

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const jobSeekersRouter = createTRPCRouter({
  /**
   * Returns the authenticated seeker's own full profile.
   * Identity comes from ctx.seeker — injected by seekerProcedure middleware.
   * Omits parsedResume and all SeekerSettings fields.
   */
  getMe: seekerProcedure.query(({ ctx }) => {
    return toFullProfile(ctx.seeker)
  }),

  /**
   * Returns a public seeker profile by id.
   * Omits resumeUrl, parsedResume, createdAt, and SeekerSettings fields.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const seeker = await ctx.db.jobSeeker.findUnique({
        where: { id: input.id },
        select: PUBLIC_SELECT,
      })
      if (!seeker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Seeker not found" })
      }
      return {
        id: seeker.id,
        name: seeker.name,
        headline: seeker.headline,
        bio: seeker.bio,
        experience: seeker.experience,
        education: seeker.education,
        skills: seeker.skills,
        urls: seeker.profileUrls,
        location: seeker.location,
        relocationPreference: seeker.relocationPreference,
        profileCompleteness: seeker.profileCompleteness,
        isActive: seeker.isActive,
        updatedAt: seeker.updatedAt.toISOString(),
      }
    }),

  /**
   * Partial update of the authenticated seeker's profile.
   * All keys are optional; provided keys fully replace stored values (no deep merge).
   * Array fields (experience, education, skills, urls) are full-replacement.
   * Recomputes and persists profileCompleteness after writing.
   */
  updateProfile: seekerProcedure
    .input(UpdateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Build the partial update from supplied keys only
      const data: Record<string, unknown> = {}

      if (input.name !== undefined) data.name = input.name
      if (input.headline !== undefined) data.headline = input.headline
      if (input.bio !== undefined) data.bio = input.bio
      if (input.experience !== undefined) data.experience = input.experience
      if (input.education !== undefined) data.education = input.education
      if (input.skills !== undefined) data.skills = input.skills
      if (input.location !== undefined) data.location = input.location
      if (input.relocationPreference !== undefined)
        data.relocationPreference = input.relocationPreference
      // urls input → profileUrls column (Feature 3 migration added this column;
      // old urls String[] remains deprecated)
      if (input.urls !== undefined) data.profileUrls = input.urls

      // Merge with existing seeker to compute fresh completeness score
      const merged = {
        name: (data.name as string | undefined) ?? ctx.seeker.name,
        headline: (data.headline as string | null | undefined) ?? ctx.seeker.headline,
        bio: (data.bio as string | null | undefined) ?? ctx.seeker.bio,
        experience: (data.experience as unknown[]) ?? ctx.seeker.experience,
        skills: (data.skills as string[]) ?? ctx.seeker.skills,
        education: (data.education as unknown[]) ?? ctx.seeker.education,
        resumeUrl: ctx.seeker.resumeUrl,
        location: (data.location as string | null | undefined) ?? ctx.seeker.location,
      }
      data.profileCompleteness = computeProfileCompleteness(merged)

      const updated = await ctx.db.jobSeeker.update({
        where: { id: ctx.seeker.id },
        data,
      })

      return toFullProfile(updated)
    }),

  /**
   * Toggle the seeker's active status.
   * Throws CONFLICT if already in the requested state.
   */
  setActiveStatus: seekerProcedure
    .input(z.object({ isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.seeker.isActive === input.isActive) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Profile is already ${input.isActive ? "active" : "inactive"}`,
        })
      }

      const updated = await ctx.db.jobSeeker.update({
        where: { id: ctx.seeker.id },
        data: { isActive: input.isActive },
      })

      return toFullProfile(updated)
    }),
})
