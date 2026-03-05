import "server-only"
import { createCaller } from "@/server/api/root"
import { createTRPCContext } from "@/server/api/trpc"
import { headers } from "next/headers"

/**
 * tRPC server caller — for use in React Server Components (RSC) and
 * Next.js Server Actions. Bypasses HTTP entirely.
 *
 * @example
 * // In a Server Component:
 * import { api } from "@/lib/trpc/server"
 * const result = await api.health.ping()
 */
export const api = createCaller(async () => {
  const headersList = await headers()
  return createTRPCContext({
    req: new Request("http://internal", { headers: headersList }),
  })
})
