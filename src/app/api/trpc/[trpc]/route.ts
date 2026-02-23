import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/api/root"
import { createTRPCContext } from "@/server/api/trpc"

/**
 * tRPC HTTP handler for Next.js App Router.
 * Handles both GET (queries) and POST (mutations) via the fetch adapter.
 *
 * Route: /api/trpc/[trpc]
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError:
      process.env["NODE_ENV"] === "development"
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? "<no-path>"}:`, error)
          }
        : undefined,
  })

export { handler as GET, handler as POST }
