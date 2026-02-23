import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { inngest } from "@/lib/inngest"
import type { Employer, JobSeeker } from "@prisma/client"

/**
 * tRPC initialisation — context creation, procedure builders, middleware chain.
 *
 * Context hierarchy (matches contracts/trpc-api.ts):
 *   publicProcedure
 *     └─ protectedProcedure  (requires Clerk session)
 *           ├─ seekerProcedure    (requires JobSeeker row)
 *           └─ employerProcedure  (requires Employer row + orgId)
 *                 └─ adminProcedure (requires org:admin role)
 *
 * @see .specify/specs/1-foundation-infrastructure/contracts/trpc-api.ts
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface TRPCContext {
  db: typeof db
  inngest: typeof inngest
  userId: string | null
  orgId: string | null
  orgRole: "org:admin" | "org:member" | null
  userRole: "JOB_SEEKER" | "EMPLOYER" | null
}

interface CreateContextOptions {
  req: Request
}

export async function createTRPCContext({ req: _req }: CreateContextOptions): Promise<TRPCContext> {
  const { userId, orgId, orgRole, sessionClaims } = await (auth() as unknown as Promise<{
    userId: string | null
    orgId: string | null
    orgRole: "org:admin" | "org:member" | null
    sessionClaims?: { metadata?: { role?: "JOB_SEEKER" | "EMPLOYER" } }
  }>)

  return {
    db,
    inngest,
    userId: userId ?? null,
    orgId: orgId ?? null,
    orgRole: orgRole ?? null,
    userRole: (sessionClaims?.metadata?.role as "JOB_SEEKER" | "EMPLOYER" | undefined) ?? null,
  }
}

// ---------------------------------------------------------------------------
// tRPC initialisation
// ---------------------------------------------------------------------------

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Never expose stack traces outside development
        stack: process.env["NODE_ENV"] === "development" ? error.cause?.stack : undefined,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

// ---------------------------------------------------------------------------
// Middleware chain
// ---------------------------------------------------------------------------

const enforceAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.userRole) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole,
    },
  })
})

const enforceSeeker = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || ctx.userRole !== "JOB_SEEKER") {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  const seeker = await ctx.db.jobSeeker.findUnique({
    where: { clerkUserId: ctx.userId },
  })
  if (!seeker) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Seeker profile not found" })
  }
  return next({ ctx: { ...ctx, seeker } })
})

const enforceEmployer = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgId || ctx.userRole !== "EMPLOYER") {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  const employer = await ctx.db.employer.findUnique({
    where: { clerkOrgId: ctx.orgId },
  })
  if (!employer) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Employer profile not found" })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      orgId: ctx.orgId,
      orgRole: ctx.orgRole ?? ("org:member" as const),
      userRole: "EMPLOYER" as const,
      employer,
    },
  })
})

const enforceAdmin = t.middleware(async ({ ctx, next }) => {
  if (ctx.orgRole !== "org:admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" })
  }
  return next({ ctx: { ...ctx, orgRole: "org:admin" as const } })
})

// ---------------------------------------------------------------------------
// Procedure builders
// ---------------------------------------------------------------------------

export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(enforceAuthenticated)
export const seekerProcedure = protectedProcedure.use(enforceSeeker)
export const employerProcedure = protectedProcedure.use(enforceEmployer)
export const adminProcedure = employerProcedure.use(enforceAdmin)

// ---------------------------------------------------------------------------
// Test helpers (exported only for unit tests — not part of the public API)
// ---------------------------------------------------------------------------

type PartialCtx = Pick<TRPCContext, "userId" | "orgId" | "orgRole" | "userRole">

function makeTestCtx(partial: PartialCtx): TRPCContext {
  return { db, inngest: null, ...partial }
}

async function callProtected(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: protectedProcedure.query(() => "ok"),
    }),
  )(makeTestCtx(partial))
  return caller.probe()
}

async function callSeeker(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: seekerProcedure.query(() => "ok"),
    }),
  )(makeTestCtx(partial))
  return caller.probe()
}

async function callEmployer(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: employerProcedure.query(() => "ok"),
    }),
  )(makeTestCtx(partial))
  return caller.probe()
}

async function callAdmin(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: adminProcedure.query(() => "ok"),
    }),
  )(makeTestCtx(partial))
  return caller.probe()
}

export const testHelpers = {
  callProtected,
  callSeeker,
  callEmployer,
  callAdmin,
}

// Re-export context sub-types for router use
export type { JobSeeker, Employer }
