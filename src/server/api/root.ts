import { createTRPCRouter, createCallerFactory } from "@/server/api/trpc"
import { healthRouter } from "@/server/api/routers/health"
import { jobSeekersRouter } from "@/server/api/routers/jobSeekers"
import { employersRouter } from "@/server/api/routers/employers"
import { jobPostingsRouter } from "@/server/api/routers/jobPostings"
import { matchesRouter } from "@/server/api/routers/matches"
import { settingsRouter } from "@/server/api/routers/settings"
import { insightsRouter } from "@/server/api/routers/insights"
import { onboardingRouter } from "@/server/api/routers/onboarding"
import { byokRouter } from "@/server/api/routers/byok"
import { resumeRouter } from "@/server/api/routers/resume"
import { notificationsRouter } from "@/server/api/routers/notifications"
import { conversationsRouter } from "@/server/api/routers/conversations"

/**
 * Root tRPC router — assembles all sub-routers.
 *
 * @see src/server/api/trpc.ts for context and middleware
 * @see .specify/specs/1-foundation-infrastructure/contracts/trpc-api.ts for types
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  jobSeekers: jobSeekersRouter,
  employers: employersRouter,
  jobPostings: jobPostingsRouter,
  matches: matchesRouter,
  settings: settingsRouter,
  insights: insightsRouter,
  onboarding: onboardingRouter,
  byok: byokRouter,
  resume: resumeRouter,
  notifications: notificationsRouter,
  conversations: conversationsRouter,
})

/** AppRouter type — used by tRPC client for end-to-end type safety */
export type AppRouter = typeof appRouter

/** Caller factory for RSC (React Server Components) data fetching */
export const createCaller = createCallerFactory(appRouter)
