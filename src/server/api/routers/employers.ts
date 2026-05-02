import { z } from "zod"
import {
  createTRPCRouter,
  publicProcedure,
  employerProcedure,
  adminProcedure,
} from "@/server/api/trpc"
import { toFullEmployer, toPublicEmployer } from "@/server/api/helpers/employer-mapper"

// Output schema for annotated procedures (required by trpc-to-openapi)
const FullEmployerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  industry: z.string().nullable(),
  size: z.string().nullable(),
  culture: z.string().nullable(),
  headquarters: z.string().nullable(),
  locations: z.array(z.string()),
  websiteUrl: z.string().nullable(),
  urls: z.record(z.string(), z.string()),
  benefits: z.array(z.string()),
  logoUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const EMPLOYER_SELECT = {
  id: true,
  name: true,
  description: true,
  industry: true,
  size: true,
  culture: true,
  headquarters: true,
  locations: true,
  websiteUrl: true,
  urls: true,
  benefits: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
  // BYOK fields explicitly excluded
} as const

export const employersRouter = createTRPCRouter({
  getMe: employerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/employer/profile",
        summary: "Get the authenticated employer's own profile",
        tags: ["profile"],
      },
    })
    .input(z.void())
    .output(FullEmployerSchema)
    .query(({ ctx }) => {
      return toFullEmployer(ctx.employer)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const employer = await ctx.db.employer.findUnique({
        where: { id: input.id },
        select: EMPLOYER_SELECT,
      })
      if (!employer) return null
      return toPublicEmployer(employer)
    }),

  updateProfile: adminProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/employer/profile",
        summary: "Update the authenticated employer's profile",
        tags: ["profile"],
      },
    })
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(5000).optional(),
        industry: z.string().max(100).optional(),
        size: z.string().max(50).optional(),
        culture: z.string().max(5000).optional(),
        headquarters: z.string().max(255).optional(),
        locations: z.array(z.string().max(255)).max(20).optional(),
        websiteUrl: z.string().url().optional(),
        urls: z
          .record(z.string().max(100), z.string().url().max(2048))
          .refine((obj) => Object.keys(obj).length <= 20, { message: "Maximum 20 URLs allowed" })
          .optional(),
        benefits: z.array(z.string().max(255)).max(30).optional(),
      }),
    )
    .output(FullEmployerSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.employer.update({
        where: { id: ctx.employer.id },
        data: input,
        select: EMPLOYER_SELECT,
      })
      return toFullEmployer(updated)
    }),

  updateLogo: adminProcedure
    .input(z.object({ logoUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.employer.update({
        where: { id: ctx.employer.id },
        data: { logoUrl: input.logoUrl },
        select: EMPLOYER_SELECT,
      })
      return toFullEmployer(updated)
    }),
})
