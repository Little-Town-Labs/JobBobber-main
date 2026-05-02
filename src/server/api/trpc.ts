import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import type { OpenApiMeta } from "trpc-to-openapi"
import { db } from "@/lib/db"
import { getAuth } from "@/lib/auth"
import { inngest } from "@/lib/inngest"
import type { Employer, EmployerMember, JobSeeker } from "@prisma/client"

/**
 * tRPC initialisation — context creation, procedure builders, middleware chain.
 *
 * Context hierarchy:
 *   publicProcedure
 *     └─ protectedProcedure  (requires Clerk session)
 *           ├─ seekerProcedure      (requires JobSeeker row)
 *           └─ employerProcedure    (requires Employer + EmployerMember rows)
 *                 ├─ jobPosterProcedure (requires ADMIN or JOB_POSTER role)
 *                 └─ adminProcedure     (requires org:admin role)
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
  hasByokKey?: boolean
}

interface CreateContextOptions {
  req: Request
}

export async function createTRPCContext({ req: _req }: CreateContextOptions): Promise<TRPCContext> {
  const { userId, orgId, orgRole, sessionClaims } = await getAuth()

  return {
    db,
    inngest,
    userId: userId ?? null,
    orgId: orgId ?? null,
    orgRole: orgRole ?? null,
    userRole: sessionClaims?.metadata?.role ?? null,
    hasByokKey: sessionClaims?.metadata?.hasByokKey ?? false,
  }
}

// ---------------------------------------------------------------------------
// tRPC initialisation
// ---------------------------------------------------------------------------

const t = initTRPC
  .context<TRPCContext>()
  .meta<OpenApiMeta>()
  .create({
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

// onboardingProcedure tier: requires userId only; userRole may be null.
// Used exclusively by onboardingRouter.setRole (which CREATES the role —
// cannot require userRole to already exist).
const enforceSession = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

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
  const member = await ctx.db.employerMember.findUnique({
    where: { employerId_clerkUserId: { employerId: employer.id, clerkUserId: ctx.userId } },
  })
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      orgId: ctx.orgId,
      orgRole: ctx.orgRole ?? ("org:member" as const),
      userRole: "EMPLOYER" as const,
      employer,
      member,
    },
  })
})

const enforceJobPoster = t.middleware(async ({ ctx, next }) => {
  // tRPC middleware context is additive — member is set by enforceEmployer but not reflected in this middleware's ctx type
  const member = (ctx as unknown as { member: EmployerMember }).member
  if (member.role === "VIEWER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Job Poster or Admin role required" })
  }
  return next({ ctx })
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
// onboardingProcedure: userId required; userRole may be null.
// Use ONLY for the onboardingRouter — all other routers use protectedProcedure+.
export const onboardingProcedure = t.procedure.use(enforceSession)
export const protectedProcedure = t.procedure.use(enforceAuthenticated)
export const seekerProcedure = protectedProcedure.use(enforceSeeker)
export const employerProcedure = protectedProcedure.use(enforceEmployer)
export const jobPosterProcedure = employerProcedure.use(enforceJobPoster)
export const adminProcedure = employerProcedure.use(enforceAdmin)

// ---------------------------------------------------------------------------
// Test helpers (exported only for unit tests — not part of the public API)
// ---------------------------------------------------------------------------

type PartialCtx = Pick<TRPCContext, "userId" | "orgId" | "orgRole" | "userRole">

function makeTestCtx(partial: PartialCtx): TRPCContext {
  return { db, inngest: null as never, ...partial }
}

async function callOnboarding(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: onboardingProcedure.query(() => "ok"),
    }),
  )(makeTestCtx(partial))
  return caller.probe()
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

async function callJobPoster(partial: PartialCtx) {
  const caller = createCallerFactory(
    createTRPCRouter({
      probe: jobPosterProcedure.query(() => "ok"),
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
  callOnboarding,
  callProtected,
  callSeeker,
  callEmployer,
  callJobPoster,
  callAdmin,
}

// Re-export context sub-types for router use
export type { JobSeeker, Employer, EmployerMember }
