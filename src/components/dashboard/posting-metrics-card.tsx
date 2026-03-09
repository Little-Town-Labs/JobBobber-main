"use client"

import { trpc } from "@/lib/trpc/client"

interface PostingMetrics {
  totalConversations: number
  inProgressConversations: number
  completedEvaluations: number
  matchRate: number
  matchCounts: { total: number; pending: number; accepted: number; declined: number }
}

interface PostingMetricsCardProps {
  jobPostingId: string
}

export function PostingMetricsCard({ jobPostingId }: PostingMetricsCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (trpc.dashboard.getPostingMetrics as any).useQuery({ jobPostingId }) as {
    data: PostingMetrics | undefined
    isLoading: boolean
  }
  const { data, isLoading } = query

  if (isLoading) {
    return (
      <div data-testid="metrics-loading">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  const metrics = data ?? {
    totalConversations: 0,
    inProgressConversations: 0,
    completedEvaluations: 0,
    matchRate: 0,
    matchCounts: { total: 0, pending: 0, accepted: 0, declined: 0 },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Total Conversations" value={metrics.totalConversations} />
        <MetricTile label="In-Progress" value={metrics.inProgressConversations} />
        <MetricTile label="Completed" value={metrics.completedEvaluations} />
        <MetricTile label="Match Rate" value={`${metrics.matchRate}%`} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Total Matches" value={metrics.matchCounts.total} />
        <MetricTile label="Pending" value={metrics.matchCounts.pending} />
        <MetricTile label="Accepted" value={metrics.matchCounts.accepted} />
        <MetricTile label="Declined" value={metrics.matchCounts.declined} />
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
