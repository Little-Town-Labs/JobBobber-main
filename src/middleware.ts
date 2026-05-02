import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

/**
 * Onboarding gate middleware.
 *
 * Public routes (no authentication required):
 *   - Root homepage
 *   - Auth pages (sign-in, sign-up)
 *   - REST API v1 (auth is handled per-endpoint)
 *   - tRPC API (auth is handled per-procedure by tRPC middleware)
 *   - Inngest webhook endpoint
 *   - Clerk webhook endpoint
 *   - API docs
 *
 * Onboarding gate (authenticated users only):
 *   Gate 1: No role set → redirect to /onboarding/role
 *   Re-entry prevention: redirect users who revisit completed steps
 *
 * Gate logic is extracted to `resolveOnboardingRedirect` for unit testability.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1(.*)",
  "/api/trpc(.*)",
  "/api/inngest(.*)",
  "/api/webhooks/(.*)",
  "/docs(.*)",
])

export type OnboardingMeta = {
  role?: "JOB_SEEKER" | "EMPLOYER" | null
}

/**
 * Pure function that determines the redirect target for the onboarding gate.
 *
 * Returns the redirect path string if a redirect is needed, or null to allow
 * the request through. Exported for unit testing.
 *
 * @param pathname - The request pathname (e.g. "/welcome")
 * @param meta     - Clerk session claims metadata (role)
 */
export function resolveOnboardingRedirect(pathname: string, meta: OnboardingMeta): string | null {
  const { role } = meta

  if (!role) {
    if (pathname === "/onboarding/role") return null
    return "/onboarding/role"
  }

  // Role set — re-entry prevention
  if (pathname === "/onboarding/role") return "/welcome"

  return null // allow through
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  // Enforce authentication for all non-public routes
  await auth.protect()

  // Read onboarding state from Clerk JWT claims (zero DB queries)
  const { sessionClaims } = await auth()
  const meta = sessionClaims?.metadata as OnboardingMeta | undefined

  const redirect = resolveOnboardingRedirect(req.nextUrl.pathname, meta ?? {})
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
