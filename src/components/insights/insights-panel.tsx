"use client"

import { useState } from "react"
import { useInsightsGetSeeker, useInsightsGetEmployer, useInsightsRefresh } from "@/lib/trpc/hooks"

interface InsightsPanelProps {
  variant: "seeker" | "employer"
}

export function InsightsPanel({ variant }: InsightsPanelProps) {
  const seekerQuery = useInsightsGetSeeker()
  const employerQuery = useInsightsGetEmployer()
  const { data, isLoading } = variant === "seeker" ? seekerQuery : employerQuery
  const refreshMutation = useInsightsRefresh()
  const [now] = useState(() => Date.now())

  if (isLoading) {
    return (
      <div data-testid="insights-loading">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mb-3 h-16 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const { belowThreshold, thresholdProgress } = data as InsightsData

  if (belowThreshold) {
    return (
      <div
        data-testid="insights-below-threshold"
        className="rounded-lg border border-dashed p-6 text-center"
      >
        <p className="text-sm text-gray-600">
          Insights will be available after more conversations complete.
        </p>
        <p className="mt-2 text-lg font-semibold text-gray-800">
          {thresholdProgress.current} of {thresholdProgress.required} conversations needed
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Keep your profile active to generate more conversations.
        </p>
      </div>
    )
  }

  const { strengths, weaknesses, recommendations, metrics, trendDirection, generatedAt } =
    data as InsightsData

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const isStale = generatedAt ? now - new Date(generatedAt).getTime() > THIRTY_DAYS_MS : false

  const hasAiInsights = strengths.length > 0 || weaknesses.length > 0

  return (
    <div data-testid="insights-panel" className="space-y-4">
      {/* Metrics */}
      <div data-testid="insights-metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Conversations" value={metrics.totalConversations} />
        <MetricCard label="In Progress" value={metrics.inProgressCount} />
        <MetricCard label="Match Rate" value={`${Math.round(metrics.matchRate * 100)}%`} />
        <MetricCard
          label="Conversion"
          value={`${Math.round(metrics.interviewConversionRate * 100)}%`}
        />
      </div>

      {/* Trend */}
      <div data-testid="insights-trend" className="flex items-center gap-2 text-sm">
        <span className="font-medium">Trend:</span>
        <TrendBadge direction={trendDirection} />
      </div>

      {/* AI-Generated Insights */}
      {hasAiInsights && (
        <div className="space-y-3">
          {strengths.length > 0 && (
            <InsightList title="Strengths" items={strengths} color="green" />
          )}
          {weaknesses.length > 0 && (
            <InsightList title="Areas for Improvement" items={weaknesses} color="amber" />
          )}
          {recommendations.length > 0 && (
            <InsightList title="Recommendations" items={recommendations} color="blue" />
          )}
        </div>
      )}

      {!hasAiInsights && (
        <p className="text-sm text-gray-500">
          Configure your API key in settings to receive AI-generated insights.
        </p>
      )}

      {/* Footer: stale indicator + refresh */}
      <div className="flex items-center justify-between border-t pt-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          {generatedAt && <span>Updated {new Date(generatedAt).toLocaleDateString()}</span>}
          {isStale && (
            <span
              data-testid="insights-stale"
              className="rounded bg-amber-100 px-2 py-0.5 text-amber-700"
            >
              Stale
            </span>
          )}
        </div>
        <button
          data-testid="insights-refresh"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="text-blue-600 hover:underline disabled:opacity-50"
        >
          {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function TrendBadge({ direction }: { direction: string }) {
  const config: Record<string, { label: string; className: string }> = {
    IMPROVING: { label: "Improving", className: "bg-green-100 text-green-700" },
    STABLE: { label: "Stable", className: "bg-gray-100 text-gray-700" },
    DECLINING: { label: "Declining", className: "bg-red-100 text-red-700" },
  }
  const { label, className } = config[direction] ?? config.STABLE!
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
}

function InsightList({
  title,
  items,
  color,
}: {
  title: string
  items: string[]
  color: "green" | "amber" | "blue"
}) {
  const dotColors = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
  }
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColors[color]}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface InsightsData {
  id: string | null
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  metrics: {
    totalConversations: number
    inProgressCount: number
    matchRate: number
    interviewConversionRate: number
  }
  trendDirection: string
  generatedAt: string | null
  belowThreshold: boolean
  thresholdProgress: { current: number; required: number }
}
