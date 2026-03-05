import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest"
import { functions } from "@/server/inngest/functions"

/**
 * Inngest serve handler for Next.js App Router.
 *
 * Inngest uses this endpoint to:
 *   - Discover registered functions (GET)
 *   - Invoke function runs in response to events (POST)
 *   - Deliver step results and resume paused workflows (PUT)
 *
 * Route: /api/inngest
 *
 * Local dev: run `inngest dev` alongside `pnpm dev` and point
 *   INNGEST_DEV_SERVER_URL=http://localhost:8288 in .env.local
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
