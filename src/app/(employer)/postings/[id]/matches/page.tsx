"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { MatchList } from "@/components/matches/match-list"
import { WorkflowStatus } from "@/components/matches/workflow-status"

type StatusFilter = "ALL" | "PENDING" | "ACCEPTED" | "DECLINED"
type SortOption = "confidence" | "newest"

export default function PostingMatchesPage() {
  const params = useParams<{ id: string }>()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [sort, setSort] = useState<SortOption>("confidence")
  const utils = trpc.useUtils()

  const { data: counts } = trpc.matches.getPostingStatusCounts.useQuery({
    jobPostingId: params.id,
  })

  const { data: matchesData, isLoading: loadingMatches } = trpc.matches.listForPosting.useQuery({
    jobPostingId: params.id,
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    sort,
  })

  const { data: workflowStatus, isLoading: loadingWorkflow } =
    trpc.matches.getWorkflowStatus.useQuery({ jobPostingId: params.id })

  const updateStatus = trpc.matches.updateStatus.useMutation({
    onSuccess: () => {
      utils.matches.listForPosting.invalidate({ jobPostingId: params.id })
      utils.matches.getPostingStatusCounts.invalidate({ jobPostingId: params.id })
    },
  })

  const handleAccept = (matchId: string) => {
    updateStatus.mutate({ matchId, status: "ACCEPTED" })
  }

  const handleDecline = (matchId: string) => {
    updateStatus.mutate({ matchId, status: "DECLINED" })
  }

  if (loadingMatches || loadingWorkflow) {
    return (
      <div data-testid="matches-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-24 w-full animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  const tabs: { label: string; value: StatusFilter; count: number }[] = [
    { label: "All", value: "ALL", count: counts?.all ?? 0 },
    { label: "Pending", value: "PENDING", count: counts?.pending ?? 0 },
    { label: "Accepted", value: "ACCEPTED", count: counts?.accepted ?? 0 },
    { label: "Declined", value: "DECLINED", count: counts?.declined ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <a href={`/postings/${params.id}`} className="text-sm text-blue-600 hover:underline">
          Back to posting
        </a>
      </div>

      {workflowStatus && <WorkflowStatus workflowStatus={workflowStatus} />}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="confidence">Best Match</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <MatchList
        matches={matchesData?.items ?? []}
        role="employer"
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </div>
  )
}
