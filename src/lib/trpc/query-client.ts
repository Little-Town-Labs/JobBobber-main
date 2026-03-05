import { QueryClient } from "@tanstack/react-query"

/**
 * TanStack Query client factory.
 * `staleTime: 5 * 60 * 1000` matches the tRPC contract specification.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes — data is considered fresh for 5 min
        gcTime: 10 * 60 * 1000, // 10 minutes — cache retained after unmount
      },
    },
  })
}
