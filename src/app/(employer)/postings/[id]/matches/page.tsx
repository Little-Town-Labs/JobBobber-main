"use client"

import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { MatchList } from "@/components/matches/match-list"
import { WorkflowStatus } from "@/components/matches/workflow-status"

export default function PostingMatchesPage() {
  const params = useParams<{ id: string }>()
  const utils = trpc.useUtils()

  const { data: matchesData, isLoading: loadingMatches } = trpc.matches.listForPosting.useQuery({
    jobPostingId: params.id,
  })

  const { data: workflowStatus, isLoading: loadingWorkflow } =
    trpc.matches.getWorkflowStatus.useQuery({ jobPostingId: params.id })

  const updateStatus = trpc.matches.updateStatus.useMutation({
    onSuccess: () => {
      utils.matches.listForPosting.invalidate({ jobPostingId: params.id })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <a href={`/postings/${params.id}`} className="text-sm text-blue-600 hover:underline">
          Back to posting
        </a>
      </div>

      {workflowStatus && <WorkflowStatus workflowStatus={workflowStatus} />}

      <MatchList
        matches={matchesData?.items ?? []}
        role="employer"
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </div>
  )
}
