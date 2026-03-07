"use client"

import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@/server/api/root"

/**
 * tRPC React client — used in Client Components.
 *
 * Import `trpc` from this file in any client component that calls tRPC.
 *
 * @example
 * const { data } = trpc.health.ping.useQuery()
 */
export const trpc = createTRPCReact<AppRouter>()
