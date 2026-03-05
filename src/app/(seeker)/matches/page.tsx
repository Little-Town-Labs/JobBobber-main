"use client"

import { trpc } from "@/lib/trpc/client"
import { MatchList } from "@/components/matches/match-list"

export default function SeekerMatchesPage() {
  const utils = trpc.useUtils()

  const { data: matchesData, isLoading } = trpc.matches.listForSeeker.useQuery()

  const updateStatus = trpc.matches.updateStatus.useMutation({
    onSuccess: () => {
      utils.matches.listForSeeker.invalidate()
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Matches</h1>
      <MatchList
        matches={matchesData?.items ?? []}
        role="seeker"
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </div>
  )
}
