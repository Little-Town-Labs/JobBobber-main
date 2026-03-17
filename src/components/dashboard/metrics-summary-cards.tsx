"use client"

import { formatDuration } from "@/lib/metrics/format-duration"

type TrendDirection = "improving" | "stable" | "declining" | null

interface MetricsSummaryCardsProps {
  aggregates: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
    totalPostings: number
    totalMatches: number
    totalAccepts: number
    postingsWithMatches: number
  }
  trends: {
    timeToFirstMatch: TrendDirection
    timeToMutualAccept: TrendDirection
    matchVolume: TrendDirection
  }
}

export function MetricsSummaryCards({ aggregates, trends }: MetricsSummaryCardsProps) {
  const basisLabel =
    aggregates.postingsWithMatches === 0
      ? null
      : aggregates.postingsWithMatches === 1
        ? "Based on 1 posting"
        : `Based on ${aggregates.postingsWithMatches} postings`

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Avg Time to First Match"
          value={formatDuration(aggregates.avgTimeToFirstMatchMs) ?? "—"}
          trend={trends.timeToFirstMatch}
        />
        <KpiCard
          label="Avg Time to Mutual Accept"
          value={formatDuration(aggregates.avgTimeToMutualAcceptMs) ?? "—"}
          trend={trends.timeToMutualAccept}
        />
        <KpiCard label="Total Postings" value={String(aggregates.totalPostings)} trend={null} />
        <KpiCard
          label="Total Matches"
          value={String(aggregates.totalMatches)}
          trend={trends.matchVolume}
        />
        <KpiCard label="Total Accepts" value={String(aggregates.totalAccepts)} trend={null} />
      </div>
      {basisLabel && <p className="text-xs text-gray-500">{basisLabel}</p>}
    </div>
  )
}

function KpiCard({ label, value, trend }: { label: string; value: string; trend: TrendDirection }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-bold">{value}</p>
        <TrendIndicator direction={trend} />
      </div>
    </div>
  )
}

function TrendIndicator({ direction }: { direction: TrendDirection }) {
  if (direction === null) return null

  if (direction === "improving") {
    return (
      <span data-testid="trend-improving" className="text-green-600">
        ↑
      </span>
    )
  }

  if (direction === "declining") {
    return (
      <span data-testid="trend-declining" className="text-red-600">
        ↓
      </span>
    )
  }

  return (
    <span data-testid="trend-stable" className="text-gray-400">
      —
    </span>
  )
}
