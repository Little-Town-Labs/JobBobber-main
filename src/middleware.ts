import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

/**
 * Onboarding gate middleware.
 *
 * Public routes (no authentication required):
 *   - Root homepage
 *   - Auth pages (sign-in, sign-up)
 *   - tRPC API (auth is handled per-procedure by tRPC middleware)
 *   - Inngest webhook endpoint
 *   - Clerk webhook endpoint
 *
 * Onboarding gates (authenticated users only):
 *   Gate 1: No role set → redirect to /onboarding/role
 *   Gate 2: Role set but no BYOK key → redirect to /setup/api-key
 *   Re-entry prevention: redirect users who revisit completed steps
 *
 * Gate logic is extracted to `resolveOnboardingRedirect` for unit testability.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/trpc(.*)",
  "/api/inngest(.*)",
  "/api/webhooks/(.*)",
])

export type OnboardingMeta = {
  role?: "JOB_SEEKER" | "EMPLOYER" | null
  hasByokKey?: boolean
}

/**
 * Pure function that determines the redirect target for the onboarding gates.
 *
 * Returns the redirect path string if a redirect is needed, or null to allow
 * the request through. Exported for unit testing.
 *
 * @param pathname - The request pathname (e.g. "/seeker/dashboard")
 * @param meta     - Clerk session claims metadata (role, hasByokKey)
 */
export function resolveOnboardingRedirect(pathname: string, meta: OnboardingMeta): string | null {
  const { role, hasByokKey } = meta

  // Gate 1: No role → must complete role selection
  if (!role) {
    if (pathname === "/onboarding/role") return null // allow gate destination
    return "/onboarding/role"
  }

  // Role is set —

  // Re-entry prevention: visiting /onboarding/role after role already set
  if (pathname === "/onboarding/role") {
    return "/setup/api-key"
  }

  // Gate 2: Role set but no BYOK key → must set up API key
  if (!hasByokKey) {
    if (pathname === "/setup/api-key") return null // allow gate destination
    return "/setup/api-key"
  }

  // Both role and BYOK key set —

  // Re-entry prevention: visiting /setup/api-key after fully onboarded
  if (pathname === "/setup/api-key") {
    return role === "JOB_SEEKER" ? "/seeker/dashboard" : "/employer/dashboard"
  }

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
