"use client"

import { ConfidenceBadge } from "@/components/matches/confidence-badge"

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

interface MatchCardProps {
  match: MatchResponse
  role: "employer" | "seeker"
  onAccept?: (matchId: string) => void
  onDecline?: (matchId: string) => void
}

export function MatchCard({ match, role, onAccept, onDecline }: MatchCardProps) {
  const myStatus = role === "employer" ? match.employerStatus : match.seekerStatus
  const otherStatus = role === "employer" ? match.seekerStatus : match.employerStatus
  const isPending = myStatus === "PENDING"

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <ConfidenceBadge score={match.confidenceScore} />
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">
            You: <span className="font-medium">{myStatus}</span>
          </span>
          <span className="text-gray-500">
            {role === "employer" ? "Seeker" : "Employer"}:{" "}
            <span className="font-medium">{otherStatus}</span>
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-700">{match.matchSummary}</p>

      {match.isMutualAccept && match.seekerContactInfo && (
        <div className="rounded bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">Mutual match — contact info revealed</p>
          <pre className="mt-1 text-xs text-green-700">
            {JSON.stringify(match.seekerContactInfo, null, 2)}
          </pre>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept?.(match.id)}
            className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={() => onDecline?.(match.id)}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Matched {new Date(match.createdAt).toLocaleDateString()}
      </p>
    </div>
  )
}
