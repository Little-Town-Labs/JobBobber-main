/**
 * Hiring metrics router — per-posting time-based hiring analytics.
 *
 * @see .specify/specs/27-hiring-metrics/spec.md
 *
 * Not part of the public REST API — internal employer analytics, UI-only router.
 */
import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { createTRPCRouter, employerProcedure } from "@/server/api/trpc"
import { HIRING_METRICS, assertFlagEnabled } from "@/lib/flags"
import { generateMetricsCsv } from "@/lib/metrics/csv-generator"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchRow {
  createdAt: Date
  mutualAcceptedAt: Date | null
  seekerStatus: string
  employerStatus: string
}

interface PostingWithMatches {
  id: string
  title: string
  status: string
  createdAt: Date
  matches: MatchRow[]
}

interface PostingMetric {
  id: string
  title: string
  status: string
  createdAt: Date
  firstMatchAt: Date | null
  firstMutualAcceptAt: Date | null
  timeToFirstMatchMs: number | null
  timeToMutualAcceptMs: number | null
  totalMatches: number
  totalAccepts: number
}

type TrendDirection = "improving" | "stable" | "declining" | null

const TREND_TOLERANCE = 0.05 // 5% stable zone

// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------

function computePostingMetrics(posting: PostingWithMatches): PostingMetric {
  // Defensive sort — callers should pre-sort, but guard against unsorted input
  const sorted = [...posting.matches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const firstMatch = sorted.length > 0 ? sorted[0]! : null
  const firstAccept = sorted.find((m) => m.mutualAcceptedAt !== null) ?? null

  return {
    id: posting.id,
    title: posting.title,
    status: posting.status,
    createdAt: posting.createdAt,
    firstMatchAt: firstMatch?.createdAt ?? null,
    firstMutualAcceptAt: firstAccept?.mutualAcceptedAt ?? null,
    timeToFirstMatchMs: firstMatch
      ? Math.max(0, firstMatch.createdAt.getTime() - posting.createdAt.getTime())
      : null,
    timeToMutualAcceptMs: firstAccept?.mutualAcceptedAt
      ? Math.max(0, firstAccept.mutualAcceptedAt.getTime() - posting.createdAt.getTime())
      : null,
    totalMatches: sorted.length,
    totalAccepts: sorted.filter(
      (m) => m.seekerStatus === "ACCEPTED" && m.employerStatus === "ACCEPTED",
    ).length,
  }
}

function computeAggregates(metrics: PostingMetric[]) {
  const withMatches = metrics.filter((p) => p.timeToFirstMatchMs !== null)
  const withAccepts = metrics.filter((p) => p.timeToMutualAcceptMs !== null)

  return {
    avgTimeToFirstMatchMs:
      withMatches.length > 0
        ? withMatches.reduce((sum, p) => sum + p.timeToFirstMatchMs!, 0) / withMatches.length
        : null,
    avgTimeToMutualAcceptMs:
      withAccepts.length > 0
        ? withAccepts.reduce((sum, p) => sum + p.timeToMutualAcceptMs!, 0) / withAccepts.length
        : null,
    totalPostings: metrics.length,
    totalMatches: metrics.reduce((sum, p) => sum + p.totalMatches, 0),
    totalAccepts: metrics.reduce((sum, p) => sum + p.totalAccepts, 0),
    postingsWithMatches: withMatches.length,
  }
}

function computeTimeTrend(current: number | null, previous: number | null): TrendDirection {
  if (current === null || previous === null) return null
  if (previous === 0) return current === 0 ? "stable" : "declining"

  const ratio = current / previous
  // For time metrics: lower is better, so ratio < 1 means improving
  if (ratio < 1 - TREND_TOLERANCE) return "improving"
  if (ratio > 1 + TREND_TOLERANCE) return "declining"
  return "stable"
}

function computeVolumeTrend(current: number, previous: number): TrendDirection {
  if (current === 0 && previous === 0) return null
  if (previous === 0) return "improving"

  const ratio = current / previous
  // For volume: higher is better, so ratio > 1 means improving
  if (ratio > 1 + TREND_TOLERANCE) return "improving"
  if (ratio < 1 - TREND_TOLERANCE) return "declining"
  return "stable"
}

async function computeMetricsForWindow(
  db: PrismaClient,
  employerId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  // No pagination: acceptable at current scale (<200 postings per employer per window).
  // Add cursor pagination if median employer posting volume exceeds ~500/window.
  const postings = await db.jobPosting.findMany({
    where: {
      employerId,
      createdAt: { gte: windowStart, lt: windowEnd },
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      matches: {
        select: {
          createdAt: true,
          mutualAcceptedAt: true,
          seekerStatus: true,
          employerStatus: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  const metrics = postings.map(computePostingMetrics)
  const aggregates = computeAggregates(metrics)

  return { metrics, aggregates }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const windowInput = z.object({
  windowDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
})

export const hiringMetricsRouter = createTRPCRouter({
  getHiringMetrics: employerProcedure.input(windowInput).query(async ({ ctx, input }) => {
    await assertFlagEnabled(HIRING_METRICS)

    const now = new Date()
    const windowMs = input.windowDays * 24 * 60 * 60 * 1000
    const currentStart = new Date(now.getTime() - windowMs)
    const prevStart = new Date(now.getTime() - 2 * windowMs)

    const [current, previous] = await Promise.all([
      computeMetricsForWindow(ctx.db, ctx.employer.id, currentStart, now),
      computeMetricsForWindow(ctx.db, ctx.employer.id, prevStart, currentStart),
    ])

    return {
      postings: current.metrics,
      aggregates: current.aggregates,
      previousPeriod: {
        avgTimeToFirstMatchMs: previous.aggregates.avgTimeToFirstMatchMs,
        avgTimeToMutualAcceptMs: previous.aggregates.avgTimeToMutualAcceptMs,
        totalPostings: previous.aggregates.totalPostings,
        totalMatches: previous.aggregates.totalMatches,
      },
      trends: {
        timeToFirstMatch: computeTimeTrend(
          current.aggregates.avgTimeToFirstMatchMs,
          previous.aggregates.avgTimeToFirstMatchMs,
        ),
        timeToMutualAccept: computeTimeTrend(
          current.aggregates.avgTimeToMutualAcceptMs,
          previous.aggregates.avgTimeToMutualAcceptMs,
        ),
        matchVolume: computeVolumeTrend(
          current.aggregates.totalMatches,
          previous.aggregates.totalMatches,
        ),
      },
      windowDays: input.windowDays,
    }
  }),

  exportCsv: employerProcedure.input(windowInput).mutation(async ({ ctx, input }) => {
    await assertFlagEnabled(HIRING_METRICS)

    const now = new Date()
    const windowMs = input.windowDays * 24 * 60 * 60 * 1000
    const windowStart = new Date(now.getTime() - windowMs)

    const { metrics } = await computeMetricsForWindow(ctx.db, ctx.employer.id, windowStart, now)

    const csv = generateMetricsCsv(metrics)
    const dateStr = now.toISOString().split("T")[0]
    const filename = `hiring-metrics-${input.windowDays}d-${dateStr}.csv`

    return { csv, filename }
  }),

  isEnabled: employerProcedure.query(async () => {
    const enabled = await HIRING_METRICS()
    return enabled
  }),
})
