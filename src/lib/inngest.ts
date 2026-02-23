import { Inngest } from "inngest"

/**
 * Inngest client singleton.
 *
 * Named "jobbobber" — this ID appears in the Inngest dashboard.
 * All functions registered via the route handler in /api/inngest share this client.
 *
 * @see src/server/inngest/functions/index.ts — function registry
 * @see src/app/api/inngest/route.ts — HTTP serve handler
 */
export const inngest = new Inngest({ id: "jobbobber" })
