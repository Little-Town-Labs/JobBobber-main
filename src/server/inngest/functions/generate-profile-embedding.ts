/**
 * Inngest function: generate-profile-embedding
 *
 * Generates a pgvector embedding for a job seeker profile using OpenAI.
 * Triggered when a profile is created or substantially updated.
 *
 * SECURITY: Decryption and embedding generation happen in a single step
 * to prevent the plaintext API key from being serialized into Inngest state.
 *
 * @see .specify/specs/11-vector-search/plan.md — Phase 2
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { buildProfileText, generateEmbedding, profileEmbeddingEventSchema } from "@/lib/embeddings"
import { generateAndStoreEmbedding } from "./embedding-helpers"

export const generateProfileEmbedding = inngest.createFunction(
  { id: "generate-profile-embedding", retries: 3 },
  { event: "embeddings/profile.updated" },
  async ({ event, step }) => {
    const parsed = profileEmbeddingEventSchema.safeParse(event.data)
    if (!parsed.success) {
      return { status: "FAILED", error: `Invalid event data: ${parsed.error.message}` }
    }
    const { seekerId } = parsed.data

    return generateAndStoreEmbedding({
      step,
      fetchStepName: "fetch-seeker",
      fetchContext: async () => {
        const seeker = await db.jobSeeker.findUnique({
          where: { id: seekerId },
          include: { settings: true },
        })

        if (!seeker) return { error: "Seeker not found" }

        const settings = seeker.settings
        if (!settings?.byokApiKeyEncrypted || settings.byokProvider !== "openai") {
          return { skip: true }
        }

        const text = buildProfileText({
          headline: seeker.headline,
          skills: seeker.skills,
          experience: seeker.experience as unknown[],
          education: seeker.education as unknown[],
          location: seeker.location,
        })

        if (!text) return { skip: true }

        return { text, error: null, skip: false }
      },
      decryptAndEmbed: async (text) => {
        const seeker = await db.jobSeeker.findUnique({
          where: { id: seekerId },
          include: { settings: true },
        })
        if (!seeker?.settings?.byokApiKeyEncrypted) return null

        const apiKey = await decrypt(seeker.settings.byokApiKeyEncrypted, seekerId)
        return generateEmbedding(text, apiKey)
      },
      storeEmbedding: async (vectorStr) => {
        await db.$executeRaw`
          UPDATE job_seekers
          SET profile_embedding = ${vectorStr}::vector,
              "embeddingUpdatedAt" = NOW()
          WHERE id = ${seekerId}
        `
      },
    })
  },
)
