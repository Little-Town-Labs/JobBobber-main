"use client"

import { trpc } from "@/lib/trpc/client"
import { ConfidenceBadge } from "@/components/matches/confidence-badge"

interface CandidateComparisonProps {
  jobPostingId: string
  matchIds: string[]
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

export function CandidateComparison({ jobPostingId, matchIds }: CandidateComparisonProps) {
  const utils = trpc.useUtils()

  const { data: candidates, isLoading } = trpc.matches.getForComparison.useQuery(
    { jobPostingId, matchIds },
    { enabled: matchIds.length >= 2 },
  )

  const updateStatus = trpc.matches.updateStatus.useMutation()

  if (matchIds.length < 2) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center text-sm text-yellow-800">
        Please select at least 2 candidates to compare.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-gray-500">
        Loading candidates...
      </div>
    )
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-gray-500">
        No candidate data available.
      </div>
    )
  }

  const colCount = Math.min(candidates.length, 4)
  const gridClass = GRID_COLS[colCount] ?? "grid-cols-2"

  async function handleStatusUpdate(matchId: string, status: "ACCEPTED" | "DECLINED") {
    await updateStatus.mutateAsync({ jobPostingId, matchId, status })
    void utils.matches.listForPosting.invalidate()
  }

  return (
    <div data-testid="comparison-grid" className={`grid ${gridClass} gap-4`}>
      {candidates.map((candidate) => (
        <div key={candidate.matchId} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{candidate.seekerName}</h3>
            <ConfidenceBadge score={candidate.confidenceScore} />
          </div>

          <p className="text-sm text-gray-600">{candidate.matchSummary}</p>

          <div className="flex flex-wrap gap-1">
            {candidate.seekerSkills.map((skill) => (
              <span key={skill} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {skill}
              </span>
            ))}
          </div>

          <div className="flex gap-4 text-xs text-gray-500">
            {candidate.seekerExperienceLevel && <span>{candidate.seekerExperienceLevel}</span>}
            {candidate.seekerLocation && <span>{candidate.seekerLocation}</span>}
          </div>

          {candidate.employerStatus === "PENDING" && (
            <div className="mt-auto flex gap-2">
              <button
                onClick={() => handleStatusUpdate(candidate.matchId, "ACCEPTED")}
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={() => handleStatusUpdate(candidate.matchId, "DECLINED")}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
