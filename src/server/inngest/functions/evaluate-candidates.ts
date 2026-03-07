/**
 * Inngest workflow: evaluate-candidates
 *
 * Triggered when a job posting transitions to ACTIVE. Evaluates all
 * eligible job seeker profiles against the posting using the employer's
 * BYOK API key.
 *
 * @see .specify/specs/5-basic-ai-matching/plan.md — Phase 2
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import {
  evaluateCandidate,
  type PostingInput,
  type CandidateInput,
} from "@/server/agents/employer-agent"
import { scoreToConfidence, MATCH_SCORE_THRESHOLD } from "@/lib/matching-schemas"
import { AGENT_CONVERSATIONS } from "@/lib/flags"

const BATCH_SIZE = 10

export const evaluateCandidates = inngest.createFunction(
  { id: "evaluate-candidates", retries: 3 },
  { event: "matching/posting.activated" },
  async ({ event, step }) => {
    const { jobPostingId, employerId } = event.data as {
      jobPostingId: string
      employerId: string
    }

    // Step 1: Fetch context and decrypt BYOK key
    const context = await step.run("fetch-context", async () => {
      const posting = await db.jobPosting.findUnique({ where: { id: jobPostingId } })
      if (!posting || posting.status !== "ACTIVE") {
        return { error: "Posting not found or not active" }
      }

      const employer = await db.employer.findUnique({ where: { id: employerId } })
      if (!employer?.byokApiKeyEncrypted || !employer.byokProvider) {
        return { error: "No BYOK key configured" }
      }

      const apiKey = await decrypt(employer.byokApiKeyEncrypted, employer.id)

      return {
        posting: {
          title: posting.title,
          description: posting.description,
          requiredSkills: posting.requiredSkills,
          preferredSkills: posting.preferredSkills,
          experienceLevel: posting.experienceLevel,
          employmentType: posting.employmentType,
          locationType: posting.locationType,
          locationReq: posting.locationReq,
          salaryMin: posting.salaryMin,
          salaryMax: posting.salaryMax,
          benefits: posting.benefits,
          whyApply: posting.whyApply,
        } satisfies PostingInput,
        provider: employer.byokProvider,
        apiKey,
        error: null,
      }
    })

    if (context.error) {
      return { status: "FAILED" as const, error: context.error, matchesCreated: 0 }
    }

    // Step 2: Find eligible candidates
    const candidateIds = await step.run("find-candidates", async () => {
      // Find already-matched candidates to exclude
      const existingConversations = await db.agentConversation.findMany({
        where: { jobPostingId },
        select: { seekerId: true },
      })
      const excludeIds = new Set(existingConversations.map((c) => c.seekerId))

      const candidates = await db.jobSeeker.findMany({
        where: {
          isActive: true,
          name: { not: "" },
          skills: { isEmpty: false },
        },
        select: { id: true },
      })

      return candidates.map((c) => c.id).filter((id) => !excludeIds.has(id))
    })

    if (candidateIds.length === 0) {
      return {
        status: "COMPLETED" as const,
        totalCandidates: 0,
        matchesCreated: 0,
        skippedCount: 0,
      }
    }

    // Step 2b: Check if agent-to-agent conversations are enabled
    const useConversations = await step.run("check-conversations-flag", async () => {
      try {
        return await AGENT_CONVERSATIONS()
      } catch {
        return false
      }
    })

    // When AGENT_CONVERSATIONS flag is ON, dispatch conversation events
    // instead of doing direct single-shot evaluation
    if (useConversations) {
      await step.run("dispatch-conversations", async () => {
        // Evaluate candidates with a quick initial score first
        const conversationsDispatched: string[] = []

        for (const seekerId of candidateIds) {
          const seeker = await db.jobSeeker.findUnique({ where: { id: seekerId } })
          if (!seeker) continue

          const candidate: CandidateInput = {
            name: seeker.name,
            headline: seeker.headline,
            skills: seeker.skills,
            experience: seeker.experience as unknown[],
            education: seeker.education as unknown[],
            location: seeker.location,
            profileCompleteness: seeker.profileCompleteness,
          }

          const evaluation = await evaluateCandidate(
            context.posting!,
            candidate,
            context.apiKey!,
            context.provider!,
          )

          // Only dispatch conversations for candidates above the conversation threshold
          if (evaluation && evaluation.score >= MATCH_SCORE_THRESHOLD) {
            conversationsDispatched.push(seekerId)
          }
        }

        return conversationsDispatched
      })

      // Send conversation start events for qualifying candidates
      const dispatched = await step.run("send-conversation-events", async () => {
        // Re-fetch since step.run results aren't shared
        return candidateIds
      })

      // Use step.sendEvent for each candidate
      for (const seekerId of dispatched as string[]) {
        await step.sendEvent({
          name: "conversations/start",
          data: { jobPostingId, seekerId, employerId },
        })
      }

      return {
        status: "COMPLETED" as const,
        totalCandidates: candidateIds.length,
        mode: "conversations" as const,
        conversationsDispatched: (dispatched as string[]).length,
      }
    }

    // Step 3: Evaluate in batches (original Feature 5 behavior when flag is OFF)
    let matchesCreated = 0
    let skippedCount = 0

    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const batchIds = candidateIds.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE)

      const batchResult = await step.run(`evaluate-batch-${batchNum}`, async () => {
        let batchMatches = 0
        let batchSkipped = 0

        for (const seekerId of batchIds) {
          const seeker = await db.jobSeeker.findUnique({ where: { id: seekerId } })
          if (!seeker) {
            batchSkipped++
            continue
          }

          const candidate: CandidateInput = {
            name: seeker.name,
            headline: seeker.headline,
            skills: seeker.skills,
            experience: seeker.experience as unknown[],
            education: seeker.education as unknown[],
            location: seeker.location,
            profileCompleteness: seeker.profileCompleteness,
          }

          const evaluation = await evaluateCandidate(
            context.posting!,
            candidate,
            context.apiKey!,
            context.provider!,
          )

          if (!evaluation) {
            batchSkipped++
            continue
          }

          const confidence = scoreToConfidence(evaluation.score)

          // Create AgentConversation + Match for scores above threshold
          if (evaluation.score >= MATCH_SCORE_THRESHOLD && confidence) {
            const conversation = await db.agentConversation.create({
              data: {
                jobPostingId,
                seekerId,
                status: "COMPLETED_MATCH",
                messages: [{ role: "employer_agent", content: evaluation }],
                completedAt: new Date(),
                outcome: `Match score: ${evaluation.score}`,
              },
            })

            await db.match.create({
              data: {
                conversationId: conversation.id,
                jobPostingId,
                seekerId,
                employerId,
                confidenceScore: confidence,
                matchSummary: evaluation.matchSummary,
              },
            })

            batchMatches++
          } else {
            // Below threshold — record conversation but no match
            await db.agentConversation.create({
              data: {
                jobPostingId,
                seekerId,
                status: "COMPLETED_NO_MATCH",
                messages: [{ role: "employer_agent", content: evaluation }],
                completedAt: new Date(),
                outcome: `Below threshold: ${evaluation.score}`,
              },
            })
            batchSkipped++
          }
        }

        return { matches: batchMatches, skipped: batchSkipped }
      })

      matchesCreated += batchResult.matches
      skippedCount += batchResult.skipped
    }

    return {
      status: "COMPLETED" as const,
      totalCandidates: candidateIds.length,
      matchesCreated,
      skippedCount,
    }
  },
)
