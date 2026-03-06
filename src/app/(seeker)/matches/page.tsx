"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { MatchList } from "@/components/matches/match-list"

type StatusFilter = "ALL" | "PENDING" | "ACCEPTED" | "DECLINED"
type SortOption = "confidence" | "newest"

export default function SeekerMatchesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [sort, setSort] = useState<SortOption>("confidence")
  const utils = trpc.useUtils()

  const { data: counts } = trpc.matches.getStatusCounts.useQuery()

  const { data: matchesData, isLoading } = trpc.matches.listForSeeker.useQuery({
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    sort,
  })

  const updateStatus = trpc.matches.updateStatus.useMutation({
    onSuccess: () => {
      utils.matches.listForSeeker.invalidate()
      utils.matches.getStatusCounts.invalidate()
    },
  })

  const handleAccept = (matchId: string) => {
    updateStatus.mutate({ matchId, status: "ACCEPTED" })
  }

  const handleDecline = (matchId: string) => {
    updateStatus.mutate({ matchId, status: "DECLINED" })
  }

  if (isLoading) {
    return (
      <div data-testid="seeker-matches-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
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
      <h1 className="text-2xl font-bold">Your Matches</h1>

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
        role="seeker"
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </div>
  )
}
