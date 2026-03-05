import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

/**
 * Clerk auth middleware.
 *
 * Public routes (no authentication required):
 *   - Root homepage
 *   - Auth pages (sign-in, sign-up)
 *   - tRPC API (auth is handled per-procedure by tRPC middleware)
 *   - Inngest webhook endpoint
 *   - Clerk webhook endpoint
 *
 * All other routes redirect to sign-in if unauthenticated.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/trpc(.*)",
  "/api/inngest(.*)",
  "/api/webhooks/(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
