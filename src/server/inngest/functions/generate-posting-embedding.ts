/**
 * Inngest function: generate-posting-embedding
 *
 * Generates a pgvector embedding for a job posting using OpenAI.
 * Triggered when a posting transitions to ACTIVE status.
 *
 * SECURITY: Decryption and embedding generation happen in a single step
 * to prevent the plaintext API key from being serialized into Inngest state.
 *
 * @see .specify/specs/11-vector-search/plan.md — Phase 2
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { buildPostingText, generateEmbedding, postingEmbeddingEventSchema } from "@/lib/embeddings"
import { generateAndStoreEmbedding, type EmbeddingStepConfig } from "./embedding-helpers"

export const generatePostingEmbedding = inngest.createFunction(
  { id: "generate-posting-embedding", retries: 3 },
  { event: "embeddings/posting.activated" },
  async ({ event, step }) => {
    const parsed = postingEmbeddingEventSchema.safeParse(event.data)
    if (!parsed.success) {
      return { status: "FAILED", error: `Invalid event data: ${parsed.error.message}` }
    }
    const { jobPostingId, employerId } = parsed.data

    return generateAndStoreEmbedding({
      step: step as unknown as EmbeddingStepConfig["step"], // Inngest SDK step type doesn't match EmbeddingStepConfig
      fetchStepName: "fetch-context",
      fetchContext: async () => {
        const posting = await db.jobPosting.findUnique({
          where: { id: jobPostingId },
        })

        if (!posting) return { error: "Posting not found" }

        const employer = await db.employer.findUnique({
          where: { id: employerId },
        })

        if (!employer?.byokApiKeyEncrypted || employer.byokProvider !== "openai") {
          return { skip: true }
        }

        const text = buildPostingText({
          title: posting.title,
          description: posting.description,
          requiredSkills: posting.requiredSkills,
          experienceLevel: posting.experienceLevel,
          employmentType: posting.employmentType,
          locationType: posting.locationType,
          locationReq: posting.locationReq,
          salaryMin: posting.salaryMin,
          salaryMax: posting.salaryMax,
        })

        return { text, error: null, skip: false }
      },
      decryptAndEmbed: async (text) => {
        const employer = await db.employer.findUnique({
          where: { id: employerId },
        })
        if (!employer?.byokApiKeyEncrypted) return null

        const apiKey = await decrypt(employer.byokApiKeyEncrypted, employerId)
        return generateEmbedding(text, apiKey)
      },
      storeEmbedding: async (vectorStr) => {
        await db.$executeRaw`
          UPDATE job_postings
          SET job_embedding = ${vectorStr}::vector,
              "embeddingUpdatedAt" = NOW()
          WHERE id = ${jobPostingId}
        `
      },
    })
  },
)
