/**
 * Vector embedding utilities for semantic candidate matching.
 *
 * Uses OpenAI text-embedding-3-small via the Vercel AI SDK.
 * All pgvector queries use parameterized raw SQL to prevent injection.
 *
 * @see .specify/specs/11-vector-search/contracts/embedding-api.yaml
 */
import { embed } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { db } from "@/lib/db"
import type { ExperienceEntry, EducationEntry } from "@/lib/schemas/prisma-json"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536
export const DEFAULT_SHORTLIST_SIZE = 20
export const MIN_SIMILARITY_THRESHOLD = 0.3
export const MAX_EMBEDDING_AGE_DAYS = 30

const MAX_TEXT_LENGTH = 8000
const MAX_RETRIES = 3

// ---------------------------------------------------------------------------
// Event payload schemas (Zod validation for Inngest events)
// ---------------------------------------------------------------------------

export const profileEmbeddingEventSchema = z.object({
  seekerId: z.string().min(1),
})

export const postingEmbeddingEventSchema = z.object({
  jobPostingId: z.string().min(1),
  employerId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Text builders
// ---------------------------------------------------------------------------

interface ProfileInput {
  headline: string | null
  skills: string[]
  experience: ExperienceEntry[]
  education: EducationEntry[]
  location: string | null
}

interface PostingInput {
  title: string
  description: string
  requiredSkills: string[]
  experienceLevel: string
  employmentType: string
  locationType: string
  locationReq: string | null
  salaryMin: number | null
  salaryMax: number | null
}

export function buildProfileText(profile: ProfileInput): string {
  const hasContent = profile.headline || profile.skills.length > 0

  if (!hasContent) return ""

  const parts: string[] = []

  if (profile.headline) {
    parts.push(`Title: ${profile.headline}`)
  }

  if (profile.skills.length > 0) {
    parts.push(`Skills: ${profile.skills.join(", ")}`)
  }

  if (profile.experience.length > 0) {
    const expSummary = profile.experience
      .map((e) => {
        const exp = e as Record<string, unknown>
        const pieces = [exp.title, exp.company, exp.years ? `${exp.years} years` : null]
        return pieces.filter(Boolean).join(" at ")
      })
      .join("; ")
    parts.push(`Experience: ${expSummary}`)
  }

  if (profile.education.length > 0) {
    const eduSummary = profile.education
      .map((e) => {
        const edu = e as Record<string, unknown>
        const pieces = [edu.degree, edu.institution]
        return pieces.filter(Boolean).join(" from ")
      })
      .join("; ")
    parts.push(`Education: ${eduSummary}`)
  }

  if (profile.location) {
    parts.push(`Location: ${profile.location}`)
  }

  const text = parts.join("\n")
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
}

export function buildPostingText(posting: PostingInput): string {
  const parts: string[] = []

  parts.push(`Title: ${posting.title}`)
  parts.push(`Description: ${posting.description}`)

  if (posting.requiredSkills.length > 0) {
    parts.push(`Required Skills: ${posting.requiredSkills.join(", ")}`)
  }

  parts.push(`Experience Level: ${posting.experienceLevel}`)
  parts.push(`Employment Type: ${posting.employmentType}`)

  const locationParts = [posting.locationType, posting.locationReq].filter(Boolean)
  parts.push(`Location: ${locationParts.join(" ")}`)

  if (posting.salaryMin != null && posting.salaryMax != null) {
    parts.push(`Salary Range: ${posting.salaryMin}-${posting.salaryMax}`)
  }

  const text = parts.join("\n")
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
}

// ---------------------------------------------------------------------------
// Embedding generation
// ---------------------------------------------------------------------------

export async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  const provider = createOpenAI({ apiKey })

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await embed({
        model: provider.embedding(EMBEDDING_MODEL),
        value: text,
      })
      return result.embedding
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(
          `[embeddings] Failed after ${MAX_RETRIES} attempts:`,
          error instanceof Error ? error.message : error,
        )
        return null
      }
      // Brief pause before retry
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Similarity search
// ---------------------------------------------------------------------------

interface SimilarCandidate {
  seekerId: string
  similarity: number
}

export async function findSimilarCandidates(
  postingEmbedding: number[],
  jobPostingId: string,
  limit: number = DEFAULT_SHORTLIST_SIZE,
  minSimilarity: number = MIN_SIMILARITY_THRESHOLD,
): Promise<SimilarCandidate[]> {
  if (!postingEmbedding.every(Number.isFinite)) {
    throw new Error("Invalid embedding: contains non-finite values")
  }

  const vectorStr = `[${postingEmbedding.join(",")}]`

  const results = await db.$queryRaw<SimilarCandidate[]>`
    SELECT js.id AS "seekerId",
           1 - (js.profile_embedding <=> ${vectorStr}::vector) AS similarity
    FROM job_seekers js
    WHERE js.is_active = true
      AND js.profile_embedding IS NOT NULL
      AND 1 - (js.profile_embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
      AND js.id NOT IN (
        SELECT ac.seeker_id FROM agent_conversations ac
        WHERE ac.job_posting_id = ${jobPostingId}
      )
    ORDER BY js.profile_embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `

  return results
}
