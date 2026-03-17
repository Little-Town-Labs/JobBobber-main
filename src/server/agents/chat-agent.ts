/**
 * Chat Agent — user-facing conversational AI for job seekers and employers.
 *
 * Provides context-aware Q&A about the user's profile, matches, and agent activity.
 * Read-only: cannot modify data. Uses BYOK API key for all LLM calls.
 *
 * @see .specify/specs/19-user-chat-basic/spec.md
 */
import type { PrismaClient } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatAgentContext {
  userName: string
  userRole: "JOB_SEEKER" | "EMPLOYER"
  profile: SeekerProfile | null
  matches: MatchSummary[]
  privateSettings: SeekerPrivateContext | null
  conversationSummaries: ConversationSummary[]
  postings: PostingSummary[] | null
}

interface SeekerProfile {
  headline: string | null
  skills: string[]
  location: string | null
  profileCompleteness: number
  bio: string | null
}

interface MatchSummary {
  confidenceScore: string
  matchSummary: string
  seekerStatus: string
  employerStatus: string
  jobTitle: string
  companyName?: string
}

interface SeekerPrivateContext {
  minSalary: number | null
  dealBreakers: string[]
  priorities: string[]
}

interface ConversationSummary {
  status: string
  outcome: string | null
  jobTitle: string
}

interface PostingSummary {
  title: string
  status: string
  matchCount: number
}

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble read-only context for the chat agent from the user's data.
 * Queries run in parallel for <100ms target.
 */
export async function assembleChatContext(
  db: PrismaClient,
  clerkUserId: string,
  userRole: "JOB_SEEKER" | "EMPLOYER",
): Promise<ChatAgentContext> {
  if (userRole === "JOB_SEEKER") {
    return assembleSeekerContext(db, clerkUserId)
  }
  return assembleEmployerContext(db, clerkUserId)
}

async function assembleSeekerContext(
  db: PrismaClient,
  clerkUserId: string,
): Promise<ChatAgentContext> {
  const seeker = await db.jobSeeker.findUnique({
    where: { clerkUserId },
  })

  if (!seeker) {
    return emptyContext("Unknown User", "JOB_SEEKER")
  }

  const [settings, matches, conversations] = await Promise.all([
    db.seekerSettings.findUnique({ where: { seekerId: seeker.id } }),
    db.match.findMany({
      where: { seekerId: seeker.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        jobPosting: {
          select: { title: true, employer: { select: { name: true } } },
        },
      },
    }),
    db.agentConversation.findMany({
      where: { seekerId: seeker.id },
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { jobPosting: { select: { title: true } } },
    }),
  ])

  return {
    userName: seeker.name,
    userRole: "JOB_SEEKER",
    profile: {
      headline: seeker.headline,
      skills: seeker.skills,
      location: seeker.location,
      profileCompleteness: seeker.profileCompleteness,
      bio: seeker.bio,
    },
    matches: matches.map((m) => ({
      confidenceScore: m.confidenceScore,
      matchSummary: m.matchSummary,
      seekerStatus: m.seekerStatus,
      employerStatus: m.employerStatus,
      jobTitle: (m as { jobPosting: { title: string; employer: { name: string } } }).jobPosting
        .title,
      companyName: (m as { jobPosting: { title: string; employer: { name: string } } }).jobPosting
        .employer.name,
    })),
    privateSettings: settings
      ? {
          minSalary: settings.minSalary,
          dealBreakers: settings.dealBreakers,
          priorities: settings.priorities,
        }
      : null,
    conversationSummaries: conversations.map((c) => ({
      status: c.status,
      outcome: c.outcome,
      jobTitle: (c as { jobPosting: { title: string } }).jobPosting.title,
    })),
    postings: null,
  }
}

async function assembleEmployerContext(
  db: PrismaClient,
  clerkUserId: string,
): Promise<ChatAgentContext> {
  // Employer users are identified by their org, but we need to find the employer
  // via the member table first
  const member = await db.employerMember.findFirst({
    where: { clerkUserId },
    include: { employer: true },
  })

  if (!member) {
    return emptyContext("Unknown Employer", "EMPLOYER")
  }

  const employer = member.employer

  const [postings, matches, conversations] = await Promise.all([
    db.jobPosting.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { matches: true } } },
    }),
    db.match.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        seeker: { select: { name: true } },
        jobPosting: { select: { title: true } },
      },
    }),
    db.agentConversation.findMany({
      where: { jobPostingId: { in: [] } }, // Will be filled after postings load
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { jobPosting: { select: { title: true } } },
    }),
  ])

  // Re-fetch conversations with actual posting IDs
  const postingIds = postings.map((p) => p.id)
  const actualConversations =
    postingIds.length > 0
      ? await db.agentConversation.findMany({
          where: { jobPostingId: { in: postingIds } },
          orderBy: { startedAt: "desc" },
          take: 10,
          include: { jobPosting: { select: { title: true } } },
        })
      : conversations

  return {
    userName: employer.name,
    userRole: "EMPLOYER",
    profile: null,
    matches: matches.map((m) => ({
      confidenceScore: m.confidenceScore,
      matchSummary: m.matchSummary,
      seekerStatus: m.seekerStatus,
      employerStatus: m.employerStatus,
      jobTitle: (m as { jobPosting: { title: string } }).jobPosting.title,
      companyName: undefined,
    })),
    privateSettings: null,
    conversationSummaries: actualConversations.map((c) => ({
      status: c.status,
      outcome: c.outcome,
      jobTitle: (c as { jobPosting: { title: string } }).jobPosting.title,
    })),
    postings: postings.map((p) => ({
      title: p.title,
      status: p.status,
      matchCount: (p as { _count: { matches: number } })._count.matches,
    })),
  }
}

function emptyContext(userName: string, userRole: "JOB_SEEKER" | "EMPLOYER"): ChatAgentContext {
  return {
    userName,
    userRole,
    profile: null,
    matches: [],
    privateSettings: null,
    conversationSummaries: [],
    postings: userRole === "EMPLOYER" ? [] : null,
  }
}

// ---------------------------------------------------------------------------
// System Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the chat agent, injecting user context.
 */
export function buildChatSystemPrompt(context: ChatAgentContext): string {
  const sections: string[] = []

  sections.push(
    `You are ${context.userName}'s personal JobBobber agent — an AI assistant that helps with ${context.userRole === "JOB_SEEKER" ? "job searching" : "hiring and recruitment"}.`,
  )

  sections.push(`IMPORTANT RULES:
- You are a read-only assistant. You cannot take actions, modify data, or make changes. You can only provide information, explanations, and advice.
- Stay focused on job search and hiring topics. If the user asks off-topic questions, politely redirect: "I'm best at helping with your job search — try asking about your matches or profile."
- Never fabricate data. If you don't have information, say so.
- Never reveal other users' private data. You only know about ${context.userName}'s own data.`)

  if (context.profile) {
    const p = context.profile
    sections.push(`YOUR USER'S PROFILE:
- Name: ${context.userName}
- Headline: ${p.headline ?? "Not set"}
- Skills: ${p.skills.length > 0 ? p.skills.join(", ") : "None added"}
- Location: ${p.location ?? "Not set"}
- Bio: ${p.bio ?? "Not set"}
- Profile completeness: ${Math.round(p.profileCompleteness * 100)}%`)
  }

  if (context.privateSettings) {
    const ps = context.privateSettings
    sections.push(`YOUR USER'S PRIVATE PREFERENCES (only share with the user themselves):
- Minimum salary: ${ps.minSalary ? `$${ps.minSalary.toLocaleString()}` : "Not set"}
- Deal-breakers: ${ps.dealBreakers.length > 0 ? ps.dealBreakers.join(", ") : "None set"}
- Priorities: ${ps.priorities.length > 0 ? ps.priorities.join(", ") : "None set"}`)
  }

  if (context.postings && context.postings.length > 0) {
    const postingLines = context.postings
      .map((p) => `- ${p.title} (${p.status}) — ${p.matchCount} matches`)
      .join("\n")
    sections.push(`YOUR USER'S JOB POSTINGS:\n${postingLines}`)
  }

  const matchCount = context.matches.length
  if (matchCount > 0) {
    const matchLines = context.matches
      .map(
        (m) =>
          `- ${m.jobTitle}${m.companyName ? ` at ${m.companyName}` : ""}: ${m.confidenceScore} confidence — ${m.matchSummary.slice(0, 100)}`,
      )
      .join("\n")
    sections.push(
      `YOUR USER'S MATCHES (${matchCount} match${matchCount !== 1 ? "es" : ""}):\n${matchLines}`,
    )
  } else {
    sections.push("YOUR USER'S MATCHES: No matches yet.")
  }

  if (context.conversationSummaries.length > 0) {
    const convLines = context.conversationSummaries
      .map((c) => `- ${c.jobTitle}: ${c.status}${c.outcome ? ` (${c.outcome})` : ""}`)
      .join("\n")
    sections.push(`RECENT AGENT ACTIVITY:\n${convLines}`)
  }

  return sections.join("\n\n")
}
