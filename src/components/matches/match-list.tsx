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
  seekerContactInfo: Record<string, unknown> | null
  seekerAvailability: Record<string, unknown> | null
  isMutualAccept: boolean
  createdAt: string
  updatedAt: string
}

interface MatchListProps {
  matches: MatchResponse[]
  role: "employer" | "seeker"
  onAccept?: (matchId: string) => void
  onDecline?: (matchId: string) => void
}

export function MatchList({ matches, role, onAccept, onDecline }: MatchListProps) {
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
        <MatchCard
          key={match.id}
          match={match}
          role={role}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ))}
    </div>
  )
}
