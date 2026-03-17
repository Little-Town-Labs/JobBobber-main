/**
 * Chat tools — callable functions for the user-facing chat agent.
 *
 * Tools query the database directly and return structured data for the LLM
 * to summarize in natural language. All tools are read-only and ownership-scoped.
 *
 * @see .specify/specs/20-agent-tool-calling/spec.md
 */
import { tool } from "ai"
import { z } from "zod"
import type { PrismaClient } from "@prisma/client"

const MAX_RESULTS = 10

// ---------------------------------------------------------------------------
// Output types (exported for Feature 21 component rendering)
// ---------------------------------------------------------------------------

export interface JobSearchResult {
  title: string
  company: string
  location: string | null
  locationType: string
  salaryMin: number | null
  salaryMax: number | null
  employmentType: string
  experienceLevel: string
}

export interface MatchResult {
  id: string
  jobTitle: string
  companyName: string
  confidenceScore: string
  seekerStatus: string
  employerStatus: string
  matchSummary: string
}

export interface ProfileResult {
  name: string
  headline: string | null
  skills: string[]
  location: string | null
  profileCompleteness: number
  experienceCount: number
  educationCount: number
}

export interface ConversationResult {
  jobTitle: string
  status: string
  outcome: string | null
  startedAt: string
}

export interface PostingResult {
  id: string
  title: string
  status: string
  matchCount: number
}

export interface CandidateResult {
  matchId: string
  candidateName: string
  confidenceScore: string
  matchSummary: string
  seekerStatus: string
  employerStatus: string
}

export interface PostingDetailResult {
  title: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: string
  employmentType: string
  locationType: string
  salaryMin: number | null
  salaryMax: number | null
  status: string
  matchCount: number
}

// ---------------------------------------------------------------------------
// Seeker Tools
// ---------------------------------------------------------------------------

const searchJobsSchema = z.object({
  query: z.string().describe("Search keywords — skills, job title, or company name"),
  location: z.string().optional().describe("Location filter (city or remote)"),
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT"])
    .optional()
    .describe("Employment type filter"),
})

type SearchJobsInput = z.infer<typeof searchJobsSchema>

const getMyMatchesSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional().describe("Filter by your status"),
})

type GetMyMatchesInput = z.infer<typeof getMyMatchesSchema>

const getMyProfileSchema = z.object({})

type GetMyProfileInput = z.infer<typeof getMyProfileSchema>

const getConversationSummarySeekerSchema = z.object({
  companyOrTitle: z.string().describe("Company name or job posting title to look up"),
})

type GetConversationSummarySeekerInput = z.infer<typeof getConversationSummarySeekerSchema>

const getCandidatesSchema = z.object({
  postingTitle: z.string().describe("Job posting title to look up candidates for"),
})

type GetCandidatesInput = z.infer<typeof getCandidatesSchema>

const getMyPostingsSchema = z.object({
  status: z
    .enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "FILLED"])
    .optional()
    .describe("Filter by posting status"),
})

type GetMyPostingsInput = z.infer<typeof getMyPostingsSchema>

const getPostingDetailsSchema = z.object({
  postingTitle: z.string().describe("Job posting title to look up"),
})

type GetPostingDetailsInput = z.infer<typeof getPostingDetailsSchema>

const getConversationSummaryEmployerSchema = z.object({
  postingTitle: z.string().describe("Job posting title to look up conversations for"),
})

type GetConversationSummaryEmployerInput = z.infer<typeof getConversationSummaryEmployerSchema>

export function buildSeekerTools(db: PrismaClient, seekerId: string) {
  return {
    searchJobs: tool({
      description:
        "Search active job postings by keywords, skills, or location. Returns up to 10 matching positions.",
      inputSchema: searchJobsSchema,
      execute: async (params: SearchJobsInput): Promise<JobSearchResult[]> => {
        const { query, location, employmentType } = params
        const words = query
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 1)

        const postings = await db.jobPosting.findMany({
          where: {
            status: "ACTIVE",
            ...(employmentType ? { employmentType } : {}),
            ...(location
              ? { locationReq: { contains: location, mode: "insensitive" as const } }
              : {}),
            OR: words.flatMap((word) => [
              { title: { contains: word, mode: "insensitive" as const } },
              { description: { contains: word, mode: "insensitive" as const } },
              { requiredSkills: { has: word } },
            ]),
          },
          include: { employer: { select: { name: true } } },
          take: MAX_RESULTS,
          orderBy: { createdAt: "desc" },
        })

        return postings.map((p) => ({
          title: p.title,
          company: (p as { employer: { name: string } }).employer.name,
          location: p.locationReq,
          locationType: p.locationType,
          salaryMin: p.salaryMin,
          salaryMax: p.salaryMax,
          employmentType: p.employmentType,
          experienceLevel: p.experienceLevel,
        }))
      },
    }),

    getMyMatches: tool({
      description:
        "List your current matches with job titles, companies, confidence scores, and statuses.",
      inputSchema: getMyMatchesSchema,
      execute: async (params: GetMyMatchesInput): Promise<MatchResult[]> => {
        const { status } = params
        const matches = await db.match.findMany({
          where: {
            seekerId,
            ...(status ? { seekerStatus: status } : {}),
          },
          include: {
            jobPosting: {
              select: { title: true, employer: { select: { name: true } } },
            },
          },
          take: MAX_RESULTS,
          orderBy: { createdAt: "desc" },
        })

        return matches.map((m) => ({
          id: m.id,
          jobTitle: (m as { jobPosting: { title: string } }).jobPosting.title,
          companyName: (m as { jobPosting: { employer: { name: string } } }).jobPosting.employer
            .name,
          confidenceScore: m.confidenceScore,
          seekerStatus: m.seekerStatus,
          employerStatus: m.employerStatus,
          matchSummary: m.matchSummary.slice(0, 200),
        }))
      },
    }),

    getMyProfile: tool({
      description:
        "Get your current profile data including skills, experience, and completeness score.",
      inputSchema: getMyProfileSchema,
      execute: async (params: GetMyProfileInput): Promise<ProfileResult | null> => {
        void params // unused
        const seeker = await db.jobSeeker.findUnique({
          where: { id: seekerId },
        })
        if (!seeker) return null

        return {
          name: seeker.name,
          headline: seeker.headline,
          skills: seeker.skills,
          location: seeker.location,
          profileCompleteness: seeker.profileCompleteness,
          experienceCount: Array.isArray(seeker.experience) ? seeker.experience.length : 0,
          educationCount: Array.isArray(seeker.education) ? seeker.education.length : 0,
        }
      },
    }),

    getConversationSummary: tool({
      description:
        "Get the summary and outcome of your agent's conversation with a specific company or job posting.",
      inputSchema: getConversationSummarySeekerSchema,
      execute: async (
        params: GetConversationSummarySeekerInput,
      ): Promise<ConversationResult | null> => {
        const { companyOrTitle } = params
        const conversations = await db.agentConversation.findMany({
          where: { seekerId },
          include: {
            jobPosting: {
              select: {
                title: true,
                employer: { select: { name: true } },
              },
            },
          },
          orderBy: { startedAt: "desc" },
          take: 20,
        })

        const query = companyOrTitle.toLowerCase()
        const match = conversations.find((c) => {
          const posting = c as { jobPosting: { title: string; employer: { name: string } } }
          return (
            posting.jobPosting.title.toLowerCase().includes(query) ||
            posting.jobPosting.employer.name.toLowerCase().includes(query)
          )
        })

        if (!match) return null

        return {
          jobTitle: (match as { jobPosting: { title: string } }).jobPosting.title,
          status: match.status,
          outcome: match.outcome,
          startedAt: match.startedAt.toISOString(),
        }
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// Employer Tools
// ---------------------------------------------------------------------------

export function buildEmployerTools(db: PrismaClient, employerId: string) {
  return {
    getCandidates: tool({
      description:
        "List matched candidates for a specific job posting with their confidence scores and statuses.",
      inputSchema: getCandidatesSchema,
      execute: async (params: GetCandidatesInput): Promise<CandidateResult[]> => {
        const { postingTitle } = params
        const posting = await db.jobPosting.findFirst({
          where: {
            employerId,
            title: { contains: postingTitle, mode: "insensitive" },
          },
        })

        if (!posting) return []

        const matches = await db.match.findMany({
          where: { jobPostingId: posting.id, employerId },
          include: { seeker: { select: { name: true } } },
          take: MAX_RESULTS,
          orderBy: { createdAt: "desc" },
        })

        return matches.map((m) => ({
          matchId: m.id,
          candidateName: (m as { seeker: { name: string } }).seeker.name,
          confidenceScore: m.confidenceScore,
          matchSummary: m.matchSummary.slice(0, 200),
          seekerStatus: m.seekerStatus,
          employerStatus: m.employerStatus,
        }))
      },
    }),

    getMyPostings: tool({
      description: "List all your job postings with their statuses and match counts.",
      inputSchema: getMyPostingsSchema,
      execute: async (params: GetMyPostingsInput): Promise<PostingResult[]> => {
        const { status } = params
        const postings = await db.jobPosting.findMany({
          where: {
            employerId,
            ...(status ? { status } : {}),
          },
          include: { _count: { select: { matches: true } } },
          take: 20,
          orderBy: { createdAt: "desc" },
        })

        return postings.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          matchCount: (p as { _count: { matches: number } })._count.matches,
        }))
      },
    }),

    getPostingDetails: tool({
      description:
        "Get full details of a specific job posting including description and requirements.",
      inputSchema: getPostingDetailsSchema,
      execute: async (params: GetPostingDetailsInput): Promise<PostingDetailResult | null> => {
        const { postingTitle } = params
        const posting = await db.jobPosting.findFirst({
          where: {
            employerId,
            title: { contains: postingTitle, mode: "insensitive" },
          },
          include: { _count: { select: { matches: true } } },
        })

        if (!posting) return null

        return {
          title: posting.title,
          description: posting.description.slice(0, 500),
          requiredSkills: posting.requiredSkills,
          preferredSkills: posting.preferredSkills,
          experienceLevel: posting.experienceLevel,
          employmentType: posting.employmentType,
          locationType: posting.locationType,
          salaryMin: posting.salaryMin,
          salaryMax: posting.salaryMax,
          status: posting.status,
          matchCount: (posting as { _count: { matches: number } })._count.matches,
        }
      },
    }),

    getConversationSummary: tool({
      description: "Get the summary and outcome of agent conversations for a specific job posting.",
      inputSchema: getConversationSummaryEmployerSchema,
      execute: async (
        params: GetConversationSummaryEmployerInput,
      ): Promise<ConversationResult[]> => {
        const { postingTitle } = params
        const posting = await db.jobPosting.findFirst({
          where: {
            employerId,
            title: { contains: postingTitle, mode: "insensitive" },
          },
        })

        if (!posting) return []

        const conversations = await db.agentConversation.findMany({
          where: { jobPostingId: posting.id },
          include: { jobPosting: { select: { title: true } } },
          take: MAX_RESULTS,
          orderBy: { startedAt: "desc" },
        })

        return conversations.map((c) => ({
          jobTitle: (c as { jobPosting: { title: string } }).jobPosting.title,
          status: c.status,
          outcome: c.outcome,
          startedAt: c.startedAt.toISOString(),
        }))
      },
    }),
  }
}
