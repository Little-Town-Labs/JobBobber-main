"use client"

import type { inferRouterOutputs, inferRouterInputs } from "@trpc/server"
import type { AppRouter } from "@/server/api/root"

/**
 * Pre-computed router output and input types.
 *
 * These resolve the full AppRouter type once at module level, preventing
 * TypeScript from recomputing the deep recursive inference chain at every
 * .useQuery() / .useMutation() call site (which causes TS2589 overflow).
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>
export type RouterInputs = inferRouterInputs<AppRouter>
