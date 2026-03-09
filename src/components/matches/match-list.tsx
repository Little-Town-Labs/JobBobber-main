"use client"

import { MatchCard } from "@/components/matches/match-card"

interface MatchResponse {
  id: string
  conversationId: string
  jobPostingId: string
  seekerId: string
  employerId: string
  confidenceScore: string
  matchSummary: string
  seekerStatus: string
  employerStatus: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seekerContactInfo: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seekerAvailability: any
  isMutualAccept: boolean
  createdAt: string
  updatedAt: string
}

interface MatchListProps {
  matches: MatchResponse[]
  role: "employer" | "seeker"
  onAccept?: (matchId: string) => void
  onDecline?: (matchId: string) => void
  selectedIds?: string[]
  onSelectToggle?: (matchId: string) => void
}

export function MatchList({
  matches,
  role,
  onAccept,
  onDecline,
  selectedIds,
  onSelectToggle,
}: MatchListProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-gray-500">No matches yet.</p>
        <p className="mt-1 text-sm text-gray-400">
          {role === "employer"
            ? "Matches will appear here once the AI evaluates candidates."
            : "Matches will appear here when employers find you as a potential fit."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <div key={match.id} className="flex items-start gap-3">
          {onSelectToggle && (
            <input
              type="checkbox"
              checked={selectedIds?.includes(match.id) ?? false}
              onChange={() => onSelectToggle(match.id)}
              className="mt-4 h-4 w-4 rounded border-gray-300"
              aria-label={`Select ${match.id}`}
            />
          )}
          <div className="flex-1">
            <MatchCard match={match} role={role} onAccept={onAccept} onDecline={onDecline} />
          </div>
        </div>
      ))}
    </div>
  )
}
