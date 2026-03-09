/**
 * Aggregation functions for feedback insight generation.
 *
 * PRIVACY BOUNDARY: These functions are the single point of control for
 * what data reaches the LLM. Output contains ONLY anonymized statistics —
 * never raw messages, names, IDs, or private parameters.
 */
import { db } from "@/lib/db"
import {
  type InsightGenerationInput,
  MAX_CONVERSATIONS_FOR_PATTERNS,
  RECENT_WINDOW_SIZE,
} from "./insight-schemas"

type ConversationStatus = "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | "TERMINATED" | "IN_PROGRESS"

interface ConversationRow {
  status: string
  completedAt: Date | null
}

interface MatchRow {
  seekerStatus: string
  employerStatus: string
}

interface ConfidenceGroup {
  confidenceScore: string
  _count: { _all: number }
}

/** Build anonymized insight context for a job seeker */
export async function buildSeekerInsightContext(seekerId: string): Promise<InsightGenerationInput> {
  const conversations = await db.agentConversation.findMany({
    where: { seekerId },
    select: { status: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: MAX_CONVERSATIONS_FOR_PATTERNS,
  })

  const matches = await db.match.findMany({
    where: { seekerId },
    select: { seekerStatus: true, employerStatus: true },
  })

  const confidenceGroups = (await (db.match.groupBy as Function)({
    where: { seekerId },
    by: ["confidenceScore"],
    _count: { _all: true },
  })) as ConfidenceGroup[]

  return buildContext("JOB_SEEKER", conversations, matches, confidenceGroups, "seekerStatus")
}

/** Build anonymized insight context for an employer */
export async function buildEmployerInsightContext(
  employerId: string,
  jobPostingId?: string,
): Promise<InsightGenerationInput> {
  // Get posting IDs to scope conversations
  const postingFilter = jobPostingId
    ? { jobPostingId }
    : {
        jobPostingId: {
          in: (
            await db.jobPosting.findMany({
              where: { employerId },
              select: { id: true },
            })
          ).map((p) => p.id),
        },
      }

  const conversations = await db.agentConversation.findMany({
    where: postingFilter,
    select: { status: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: MAX_CONVERSATIONS_FOR_PATTERNS,
  })

  const matchWhere = jobPostingId ? { jobPostingId } : { employerId }
  const matches = await db.match.findMany({
    where: matchWhere,
    select: { seekerStatus: true, employerStatus: true },
  })

  const confidenceGroups = (await (db.match.groupBy as Function)({
    where: matchWhere,
    by: ["confidenceScore"],
    _count: { _all: true },
  })) as ConfidenceGroup[]

  return buildContext("EMPLOYER", conversations, matches, confidenceGroups, "employerStatus")
}

/** Shared aggregation logic — returns only anonymized statistics */
function buildContext(
  userType: "JOB_SEEKER" | "EMPLOYER",
  conversations: ConversationRow[],
  matches: MatchRow[],
  confidenceGroups: ConfidenceGroup[],
  statusField: "seekerStatus" | "employerStatus",
): InsightGenerationInput {
  const completedMatch = conversations.filter((c) => c.status === "COMPLETED_MATCH").length
  const completedNoMatch = conversations.filter((c) => c.status === "COMPLETED_NO_MATCH").length
  const terminated = conversations.filter((c) => c.status === "TERMINATED").length
  const inProgress = conversations.filter((c) => c.status === "IN_PROGRESS").length
  const totalCompleted = completedMatch + completedNoMatch + terminated

  const matchRate = totalCompleted > 0 ? completedMatch / totalCompleted : 0

  // Acceptance rate: how often matches are accepted by this user
  const acceptedCount = matches.filter((m) => m[statusField] === "ACCEPTED").length
  const acceptanceRate = matches.length > 0 ? acceptedCount / matches.length : 0

  // Confidence distribution
  const confidenceDistribution = { STRONG: 0, GOOD: 0, POTENTIAL: 0 }
  for (const g of confidenceGroups) {
    const key = g.confidenceScore as keyof typeof confidenceDistribution
    if (key in confidenceDistribution) {
      confidenceDistribution[key] = g._count._all
    }
  }

  // Recent outcomes for trend calculation
  const completed = conversations.filter((c) => c.status !== "IN_PROGRESS" && c.completedAt != null)
  const recent = completed.slice(0, RECENT_WINDOW_SIZE)
  const recentOutcomes = recent.map((c) => statusToOutcome(c.status as ConversationStatus))

  const recentMatchCount = recentOutcomes.filter((o) => o === "MATCH").length
  const recentMatchRate = recentOutcomes.length > 0 ? recentMatchCount / recentOutcomes.length : 0

  // Pattern summaries — computed from aggregate counts, not raw data
  const patternSummaries: string[] = []
  if (completedNoMatch > 0 && totalCompleted > 0) {
    const noMatchPct = Math.round((completedNoMatch / totalCompleted) * 100)
    patternSummaries.push(
      `${noMatchPct}% of completed conversations resulted in no match (${completedNoMatch} of ${totalCompleted})`,
    )
  }
  if (confidenceDistribution.STRONG > 0) {
    patternSummaries.push(`${confidenceDistribution.STRONG} matches rated as strong confidence`)
  }
  if (acceptanceRate < 0.5 && matches.length >= 2) {
    patternSummaries.push(`Acceptance rate is below 50% (${Math.round(acceptanceRate * 100)}%)`)
  }
  if (recentMatchRate > matchRate && totalCompleted >= RECENT_WINDOW_SIZE) {
    patternSummaries.push("Recent match rate is trending above overall average")
  } else if (recentMatchRate < matchRate && totalCompleted >= RECENT_WINDOW_SIZE) {
    patternSummaries.push("Recent match rate is trending below overall average")
  }

  return {
    userType,
    totalConversations: conversations.length,
    completedMatchCount: completedMatch,
    completedNoMatchCount: completedNoMatch,
    terminatedCount: terminated,
    inProgressCount: inProgress,
    matchRate,
    acceptanceRate,
    confidenceDistribution,
    recentOutcomes,
    overallMatchRate: matchRate,
    recentMatchRate,
    patternSummaries,
  }
}

function statusToOutcome(status: ConversationStatus): "MATCH" | "NO_MATCH" | "TERMINATED" {
  switch (status) {
    case "COMPLETED_MATCH":
      return "MATCH"
    case "COMPLETED_NO_MATCH":
      return "NO_MATCH"
    case "TERMINATED":
      return "TERMINATED"
    default:
      return "NO_MATCH"
  }
}
