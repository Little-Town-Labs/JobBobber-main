"use client"

/**
 * Typed tRPC hooks that bypass TS2589 inference overflow.
 *
 * The full AppRouter type is too deep for TypeScript to infer at every
 * .useQuery()/.useMutation() call site. These hooks pre-resolve the
 * output types via inferRouterOutputs (which compiles fine at module level)
 * and provide typed wrappers.
 *
 * Usage: import { useTeamListMembers } from "@/lib/trpc/hooks"
 *        const { data, isLoading } = useTeamListMembers()
 *
 * @see src/lib/trpc/router-types.ts for RouterOutputs/RouterInputs
 */

import { trpc } from "./client"
import type { RouterOutputs, RouterInputs } from "./router-types"

// ---------------------------------------------------------------------------
// Generic typed query/mutation wrappers
// ---------------------------------------------------------------------------

type AnyQueryHook = { useQuery: (...args: unknown[]) => unknown }
type AnyMutationHook = { useMutation: (...args: unknown[]) => unknown }
type AnyInfiniteQueryHook = { useInfiniteQuery: (...args: unknown[]) => unknown }

interface TypedQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error: { message: string } | null
  refetch: () => Promise<{ data: T | undefined }>
  isFetching: boolean
}

interface TypedMutationResult<TInput, TOutput> {
  mutate: (input: TInput) => void
  mutateAsync: (input: TInput) => Promise<TOutput>
  isPending: boolean
  isError: boolean
  error: { message: string } | null
  data: TOutput | undefined
}

// ---------------------------------------------------------------------------
// Team router hooks
// ---------------------------------------------------------------------------

export function useTeamListMembers() {
  return (trpc.team.listMembers as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["team"]["listMembers"]
  >
}

export function useTeamListInvitations() {
  return (trpc.team.listInvitations as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["team"]["listInvitations"]
  >
}

export function useTeamInvite(options?: { onSuccess?: () => void }) {
  return (trpc.team.invite as unknown as AnyMutationHook).useMutation(
    options,
  ) as TypedMutationResult<RouterInputs["team"]["invite"], RouterOutputs["team"]["invite"]>
}

export function useTeamUpdateRole(options?: { onSuccess?: () => void }) {
  return (trpc.team.updateRole as unknown as AnyMutationHook).useMutation(
    options,
  ) as TypedMutationResult<RouterInputs["team"]["updateRole"], RouterOutputs["team"]["updateRole"]>
}

export function useTeamRemoveMember(options?: { onSuccess?: () => void }) {
  return (trpc.team.removeMember as unknown as AnyMutationHook).useMutation(
    options,
  ) as TypedMutationResult<
    RouterInputs["team"]["removeMember"],
    RouterOutputs["team"]["removeMember"]
  >
}

export function useTeamRevokeInvitation(options?: { onSuccess?: () => void }) {
  return (trpc.team.revokeInvitation as unknown as AnyMutationHook).useMutation(
    options,
  ) as TypedMutationResult<
    RouterInputs["team"]["revokeInvitation"],
    RouterOutputs["team"]["revokeInvitation"]
  >
}

export function useTeamActivityLog(
  input: RouterInputs["team"]["getActivityLog"],
  options?: { getNextPageParam?: unknown },
) {
  return (trpc.team.getActivityLog as unknown as AnyInfiniteQueryHook).useInfiniteQuery(
    input,
    options,
  ) as TypedQueryResult<RouterOutputs["team"]["getActivityLog"]> & {
    hasNextPage: boolean
    fetchNextPage: () => void
    isFetchingNextPage: boolean
  }
}

// ---------------------------------------------------------------------------
// Billing router hooks
// ---------------------------------------------------------------------------

export function useBillingGetSubscription() {
  return (trpc.billing.getSubscription as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["billing"]["getSubscription"]
  >
}

export function useBillingGetUsage() {
  return (trpc.billing.getUsage as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["billing"]["getUsage"]
  >
}

export function useBillingGetPaymentHistory() {
  return (trpc.billing.getPaymentHistory as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["billing"]["getPaymentHistory"]
  >
}

// ---------------------------------------------------------------------------
// Compliance router hooks
// ---------------------------------------------------------------------------

export function useComplianceGetMfaStatus() {
  return (trpc.compliance.getMfaStatus as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["compliance"]["getMfaStatus"]
  >
}

export function useComplianceGetDeletionStatus() {
  return (
    trpc.compliance.getDeletionStatus as unknown as AnyQueryHook
  ).useQuery() as TypedQueryResult<RouterOutputs["compliance"]["getDeletionStatus"]>
}

// ---------------------------------------------------------------------------
// Dashboard router hooks
// ---------------------------------------------------------------------------

export function useDashboardGetPipelineSummary() {
  return (
    trpc.dashboard.getPipelineSummary as unknown as AnyQueryHook
  ).useQuery() as TypedQueryResult<RouterOutputs["dashboard"]["getPipelineSummary"]>
}

export function useDashboardGetPostingMetrics(
  input: RouterInputs["dashboard"]["getPostingMetrics"],
) {
  return (trpc.dashboard.getPostingMetrics as unknown as AnyQueryHook).useQuery(
    input,
  ) as TypedQueryResult<RouterOutputs["dashboard"]["getPostingMetrics"]>
}

// ---------------------------------------------------------------------------
// Matches router hooks
// ---------------------------------------------------------------------------

export function useMatchesListForPosting(input: RouterInputs["matches"]["listForPosting"]) {
  return (trpc.matches.listForPosting as unknown as AnyQueryHook).useQuery(
    input,
  ) as TypedQueryResult<RouterOutputs["matches"]["listForPosting"]>
}

export function useMatchesGetForComparison(input: RouterInputs["matches"]["getForComparison"]) {
  return (trpc.matches.getForComparison as unknown as AnyQueryHook).useQuery(
    input,
  ) as TypedQueryResult<RouterOutputs["matches"]["getForComparison"]>
}

// ---------------------------------------------------------------------------
// Settings router hooks
// ---------------------------------------------------------------------------

export function useSettingsGetSeekerSettings() {
  return (
    trpc.settings.getSeekerSettings as unknown as AnyQueryHook
  ).useQuery() as TypedQueryResult<RouterOutputs["settings"]["getSeekerSettings"]>
}

// ---------------------------------------------------------------------------
// Insights router hooks
// ---------------------------------------------------------------------------

export function useInsightsRefresh() {
  return (
    trpc.insights.refreshInsights as unknown as AnyMutationHook
  ).useMutation() as TypedMutationResult<
    RouterInputs["insights"]["refreshInsights"],
    RouterOutputs["insights"]["refreshInsights"]
  >
}

export function useInsightsGetSeeker() {
  return (
    trpc.insights.getSeekerInsights as unknown as AnyQueryHook
  ).useQuery() as TypedQueryResult<RouterOutputs["insights"]["getSeekerInsights"]>
}

export function useInsightsGetEmployer() {
  return (
    trpc.insights.getEmployerInsights as unknown as AnyQueryHook
  ).useQuery() as TypedQueryResult<RouterOutputs["insights"]["getEmployerInsights"]>
}

// ---------------------------------------------------------------------------
// Hiring Metrics router hooks
// ---------------------------------------------------------------------------

export function useHiringMetricsGet(input: RouterInputs["hiringMetrics"]["getHiringMetrics"]) {
  return (trpc.hiringMetrics.getHiringMetrics as unknown as AnyQueryHook).useQuery(
    input,
  ) as TypedQueryResult<RouterOutputs["hiringMetrics"]["getHiringMetrics"]>
}

export function useHiringMetricsExportCsv(options?: { onSuccess?: () => void }) {
  return (trpc.hiringMetrics.exportCsv as unknown as AnyMutationHook).useMutation(
    options,
  ) as TypedMutationResult<
    RouterInputs["hiringMetrics"]["exportCsv"],
    RouterOutputs["hiringMetrics"]["exportCsv"]
  >
}

export function useHiringMetricsIsEnabled() {
  return (trpc.hiringMetrics.isEnabled as unknown as AnyQueryHook).useQuery() as TypedQueryResult<
    RouterOutputs["hiringMetrics"]["isEnabled"]
  >
}

// ---------------------------------------------------------------------------
// Chat router hooks
// ---------------------------------------------------------------------------

export function useChatGetHistory(
  input?: RouterInputs["chat"]["getHistory"],
  options?: { getNextPageParam?: unknown },
) {
  return (trpc.chat.getHistory as unknown as AnyInfiniteQueryHook).useInfiniteQuery(
    input,
    options,
  ) as TypedQueryResult<RouterOutputs["chat"]["getHistory"]> & {
    hasNextPage: boolean
    fetchNextPage: () => void
    isFetchingNextPage: boolean
  }
}
