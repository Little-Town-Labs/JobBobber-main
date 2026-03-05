/**
 * Match response mapper.
 *
 * Maps Prisma Match records to safe response types, hiding contact
 * info unless both parties have accepted (mutual accept).
 */
import type { Match } from "@prisma/client"

export function isMutualAccept(match: Match): boolean {
  return match.seekerStatus === "ACCEPTED" && match.employerStatus === "ACCEPTED"
}

export function toMatchResponse(match: Match) {
  const mutual = isMutualAccept(match)
  return {
    id: match.id,
    conversationId: match.conversationId,
    jobPostingId: match.jobPostingId,
    seekerId: match.seekerId,
    employerId: match.employerId,
    confidenceScore: match.confidenceScore,
    matchSummary: match.matchSummary,
    seekerStatus: match.seekerStatus,
    employerStatus: match.employerStatus,
    seekerContactInfo: mutual ? match.seekerContactInfo : null,
    seekerAvailability: mutual ? match.seekerAvailability : null,
    isMutualAccept: mutual,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  }
}
