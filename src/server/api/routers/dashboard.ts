/**
 * Dashboard router — aggregation-focused employer queries.
 *
 * Provides pipeline summary across all postings and per-posting metrics.
 * All procedures gated behind ADVANCED_EMPLOYER_DASHBOARD feature flag.
 *
 * @see .specify/specs/17-advanced-employer-dashboard/spec.md
 *
 * Not part of the public REST API — aggregated UI data, internal employer dashboard router.
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, employerProcedure } from "@/server/api/trpc"
import { ADVANCED_EMPLOYER_DASHBOARD, assertFlagEnabled } from "@/lib/flags"

export const dashboardRouter = createTRPCRouter({
  /**
   * Pipeline summary — aggregates match and conversation counts across all
   * employer postings.
   */
  getPipelineSummary: employerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(ADVANCED_EMPLOYER_DASHBOARD)

    const employerId = ctx.employer.id

    // Fetch all postings for this employer
    const postings = await ctx.db.jobPosting.findMany({
      where: { employerId },
      select: { id: true, title: true, status: true },
    })

    if (postings.length === 0) {
      return {
        postings: [],
        totals: { totalPostings: 0, totalMatches: 0, totalPending: 0, totalAccepted: 0 },
      }
    }

    const postingIds = postings.map((p) => p.id)

    // Two groupBy queries in parallel
    const [matchGroups, conversationGroups] = await Promise.all([
      ctx.db.match.groupBy({
        by: ["jobPostingId", "employerStatus"],
        where: { jobPostingId: { in: postingIds } },
        _count: { _all: true },
      }),
      ctx.db.agentConversation.groupBy({
        by: ["jobPostingId", "status"],
        where: { jobPostingId: { in: postingIds } },
        _count: { _all: true },
      }),
    ])

    // Build per-posting match counts
    const matchCountsMap = new Map<
      string,
      { total: number; pending: number; accepted: number; declined: number }
    >()
    for (const g of matchGroups) {
      const existing = matchCountsMap.get(g.jobPostingId) ?? {
        total: 0,
        pending: 0,
        accepted: 0,
        declined: 0,
      }
      const count = g._count._all
      existing.total += count
      const key = g.employerStatus.toLowerCase() as "pending" | "accepted" | "declined"
      existing[key] += count
      matchCountsMap.set(g.jobPostingId, existing)
    }

    // Build per-posting conversation metrics
    const convMetricsMap = new Map<
      string,
      { total: number; inProgress: number; completed: number }
    >()
    for (const g of conversationGroups) {
      const existing = convMetricsMap.get(g.jobPostingId) ?? {
        total: 0,
        inProgress: 0,
        completed: 0,
      }
      const count = g._count._all
      existing.total += count
      if (g.status === "IN_PROGRESS") {
        existing.inProgress += count
      } else if (g.status === "COMPLETED_MATCH" || g.status === "COMPLETED_NO_MATCH") {
        existing.completed += count
      }
      convMetricsMap.set(g.jobPostingId, existing)
    }

    // Assemble per-posting results
    let totalMatches = 0
    let totalPending = 0
    let totalAccepted = 0

    const postingResults = postings.map((p) => {
      const mc = matchCountsMap.get(p.id) ?? { total: 0, pending: 0, accepted: 0, declined: 0 }
      const cm = convMetricsMap.get(p.id) ?? { total: 0, inProgress: 0, completed: 0 }

      // Match rate = matches with COMPLETED_MATCH / all completed evaluations
      const completedMatchCount =
        conversationGroups
          .filter((g) => g.jobPostingId === p.id && g.status === "COMPLETED_MATCH")
          .reduce((sum, g) => sum + g._count._all, 0) ?? 0

      const matchRate =
        cm.completed > 0 ? Math.round((completedMatchCount / cm.completed) * 100) : 0

      totalMatches += mc.total
      totalPending += mc.pending
      totalAccepted += mc.accepted

      return {
        id: p.id,
        title: p.title,
        status: p.status,
        matchCounts: mc,
        matchRate,
        conversationMetrics: cm,
      }
    })

    return {
      postings: postingResults,
      totals: {
        totalPostings: postings.length,
        totalMatches,
        totalPending,
        totalAccepted,
      },
    }
  }),

  /**
   * Per-posting metrics — conversation and match stats for a single posting.
   */
  getPostingMetrics: employerProcedure
    .input(z.object({ jobPostingId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(ADVANCED_EMPLOYER_DASHBOARD)

      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const [conversationGroups, matchGroups] = await Promise.all([
        ctx.db.agentConversation.groupBy({
          by: ["status"],
          where: { jobPostingId: input.jobPostingId },
          _count: { _all: true },
        }),
        ctx.db.match.groupBy({
          by: ["employerStatus"],
          where: { jobPostingId: input.jobPostingId },
          _count: { _all: true },
        }),
      ])

      // Conversation metrics
      let totalConversations = 0
      let inProgressConversations = 0
      let completedEvaluations = 0
      let completedMatchCount = 0

      for (const g of conversationGroups) {
        const count = g._count._all
        totalConversations += count
        if (g.status === "IN_PROGRESS") {
          inProgressConversations += count
        } else if (g.status === "COMPLETED_MATCH" || g.status === "COMPLETED_NO_MATCH") {
          completedEvaluations += count
          if (g.status === "COMPLETED_MATCH") {
            completedMatchCount += count
          }
        }
      }

      // Match counts
      const matchCounts = { total: 0, pending: 0, accepted: 0, declined: 0 }
      for (const g of matchGroups) {
        const count = g._count._all
        matchCounts.total += count
        const key = g.employerStatus.toLowerCase() as "pending" | "accepted" | "declined"
        matchCounts[key] += count
      }

      const matchRate =
        completedEvaluations > 0
          ? Math.round((completedMatchCount / completedEvaluations) * 100)
          : 0

      return {
        totalConversations,
        inProgressConversations,
        completedEvaluations,
        matchRate,
        matchCounts,
      }
    }),
})
