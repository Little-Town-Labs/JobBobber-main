/**
 * Inngest workflow: run-agent-conversation
 *
 * Manages a full multi-turn conversation between Employer Agent and
 * Job Seeker Agent. One Inngest step per turn for maximum resumability.
 *
 * @see .specify/specs/9-agent-to-agent-conversations/plan.md — Phase 3
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { type Prisma } from "@prisma/client"
import { decrypt } from "@/lib/encryption"
import {
  runConversationTurn,
  shouldTerminate,
  type OrchestratorInput,
} from "@/server/agents/conversation-orchestrator"
import { type PostingInput, type CandidateInput } from "@/server/agents/employer-agent"
import { type OpportunityInput, type SeekerPrivateSettings } from "@/server/agents/seeker-agent"
import type { ConversationMessage, ConversationPhase } from "@/lib/conversation-schemas"
import type { PrivateValues } from "@/server/agents/privacy-filter"

const MAX_TURNS = 10
const MIN_TURNS_BEFORE_DECISION = 3
const CONCURRENCY_LIMIT = 50

// ---------------------------------------------------------------------------
// Agent wrapper functions (adapt existing agents to orchestrator interface)
// ---------------------------------------------------------------------------

function makeEmployerAgentFn(posting: PostingInput, candidate: CandidateInput) {
  return async (
    _posting: unknown,
    _candidate: unknown,
    messages: ConversationMessage[],
    phase: ConversationPhase,
    apiKey: string,
    provider: string,
  ) => {
    // Re-use employer agent's evaluation but adapted for conversation turns
    const { generateObject } = await import("ai")
    const { createProvider } = await import("@/server/agents/employer-agent")
    const { agentTurnOutputSchema } = await import("@/lib/conversation-schemas")

    const historyText = messages.map((m) => `[${m.role}]: ${m.content}`).join("\n\n")

    const system = `You are an AI recruitment agent evaluating a candidate for a specific role.
You are in the ${phase} phase of a multi-turn evaluation conversation.

EVALUATION GUIDELINES:
- Evaluate the candidate ONLY on skills, experience, qualifications, and role alignment.
- You MUST NOT consider or reference protected characteristics (race, gender, age, disability, religion, national origin).
- Be fair and balanced. Focus on objective fit.

PRIVACY RULES:
- You must NOT disclose exact salary budgets, urgency levels, or internal hiring parameters.
- Express preferences qualitatively: "compensation is competitive" not exact figures.

OUTPUT REQUIREMENTS:
- content: Your conversational response (10-2000 chars)
- phase: Current conversation phase (${phase})
- decision: CONTINUE (need more info), MATCH (recommend proceeding), or NO_MATCH (not a fit)`

    const prompt = `## Job Posting
${JSON.stringify(posting, null, 2)}

## Candidate Profile
${JSON.stringify(candidate, null, 2)}

${historyText ? `## Conversation So Far\n${historyText}` : ""}

Provide your response for the ${phase} phase.`

    try {
      const model = createProvider(provider, apiKey)
      const result = await generateObject({
        model: model(provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514"),
        schema: agentTurnOutputSchema,
        system,
        prompt,
      })
      const parsed = agentTurnOutputSchema.safeParse(result.object)
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  }
}

function makeSeekerAgentFn(profile: CandidateInput, privateSettings: SeekerPrivateSettings) {
  return async (
    opportunity: unknown,
    _privateSettings: unknown,
    messages: ConversationMessage[],
    phase: ConversationPhase,
    apiKey: string,
    provider: string,
  ) => {
    const { evaluateOpportunity: evaluate } = await import("@/server/agents/seeker-agent")
    return evaluate(
      opportunity as OpportunityInput,
      {
        name: profile.name,
        headline: profile.headline,
        skills: profile.skills,
        experience: profile.experience,
        education: profile.education,
        location: profile.location,
      },
      privateSettings,
      apiKey,
      provider,
      messages,
      phase,
    )
  }
}

// ---------------------------------------------------------------------------
// Workflow handler (exported for testing)
// ---------------------------------------------------------------------------

export function buildConversationWorkflow() {
  return async ({
    event,
    step,
  }: {
    event: { data: Record<string, string> }
    step: {
      run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>
      sendEvent: (event: unknown) => Promise<void>
    }
  }) => {
    const { jobPostingId, seekerId, employerId } = event.data as {
      jobPostingId: string
      seekerId: string
      employerId: string
    }

    // Step 1: Check for duplicates and load context
    const context = await step.run("load-context", async () => {
      // Duplicate prevention
      const existing = await db.agentConversation.findFirst({
        where: { jobPostingId, seekerId, status: "IN_PROGRESS" },
      })
      if (existing) return { skip: true, reason: "Conversation already in progress" }

      // Load all entities
      const [posting, seeker, employer, seekerSettings, jobSettings] = await Promise.all([
        db.jobPosting.findUnique({ where: { id: jobPostingId } }),
        db.jobSeeker.findUnique({ where: { id: seekerId } }),
        db.employer.findUnique({ where: { id: employerId } }),
        db.seekerSettings.findUnique({ where: { seekerId } }),
        db.jobSettings.findUnique({ where: { jobPostingId } }),
      ])

      if (!posting || !seeker || !employer) {
        return { skip: true, reason: "Missing posting, seeker, or employer" }
      }

      // Check BYOK keys
      if (!employer.byokApiKeyEncrypted || !employer.byokProvider) {
        return { skip: true, reason: "Employer has no BYOK key" }
      }
      if (!seekerSettings?.byokApiKeyEncrypted || !seekerSettings.byokProvider) {
        return { skip: true, reason: "Seeker has no BYOK key" }
      }

      const postingInput: PostingInput = {
        title: posting.title,
        description: posting.description,
        requiredSkills: ((posting as Record<string, unknown>).requiredSkills as string[]) ?? [],
        preferredSkills: ((posting as Record<string, unknown>).preferredSkills as string[]) ?? [],
        experienceLevel: posting.experienceLevel,
        employmentType: posting.employmentType,
        locationType: posting.locationType,
        locationReq: ((posting as Record<string, unknown>).locationReq as string | null) ?? null,
        salaryMin: posting.salaryMin,
        salaryMax: posting.salaryMax,
        benefits: ((posting as Record<string, unknown>).benefits as string[]) ?? [],
        whyApply: ((posting as Record<string, unknown>).whyApply as string | null) ?? null,
      }

      const candidateInput: CandidateInput = {
        name: seeker.name,
        headline: seeker.headline,
        skills: seeker.skills,
        experience: seeker.experience as unknown[],
        education: seeker.education as unknown[],
        location: seeker.location,
        profileCompleteness: seeker.profileCompleteness,
      }

      const opportunityInput: OpportunityInput = {
        title: posting.title,
        description: posting.description,
        requiredSkills: ((posting as Record<string, unknown>).requiredSkills as string[]) ?? [],
        experienceLevel: posting.experienceLevel,
        employmentType: posting.employmentType,
        locationType: posting.locationType,
        salaryMin: posting.salaryMin,
        salaryMax: posting.salaryMax,
        benefits: ((posting as Record<string, unknown>).benefits as string[]) ?? [],
      }

      const seekerPrivate: SeekerPrivateSettings = {
        minSalary: seekerSettings.minSalary,
        dealBreakers: seekerSettings.dealBreakers ?? [],
        priorities: seekerSettings.priorities ?? [],
        exclusions: seekerSettings.exclusions ?? [],
      }

      const privateVals: PrivateValues = {
        seekerMinSalary: seekerSettings.minSalary,
        seekerDealBreakers: seekerSettings.dealBreakers ?? [],
        employerTrueMaxSalary: jobSettings?.trueMaxSalary ?? null,
      }

      return {
        skip: false,
        postingInput,
        candidateInput,
        opportunityInput,
        seekerPrivate,
        privateVals,
        employerProvider: employer.byokProvider,
        seekerProvider: seekerSettings.byokProvider,
        // Key refs for decryption inside turn steps (not serialized)
        employerKeyRef: { encrypted: employer.byokApiKeyEncrypted, salt: employer.id },
        seekerKeyRef: {
          encrypted: seekerSettings.byokApiKeyEncrypted,
          salt: seekerSettings.seekerId,
        },
      }
    })

    if ((context as { skip: boolean }).skip) {
      return { status: "SKIPPED" as const, reason: (context as { reason: string }).reason }
    }

    const ctx = context as {
      postingInput: PostingInput
      candidateInput: CandidateInput
      opportunityInput: OpportunityInput
      seekerPrivate: SeekerPrivateSettings
      privateVals: PrivateValues
      employerProvider: string
      seekerProvider: string
      employerKeyRef: { encrypted: string; salt: string }
      seekerKeyRef: { encrypted: string; salt: string }
    }

    // Step 2: Create conversation record
    const conversation = (await step.run("create-conversation", async () => {
      return db.agentConversation.create({
        data: {
          jobPostingId,
          seekerId,
          status: "IN_PROGRESS",
          messages: [],
        },
      })
    })) as { id: string }

    // Step 3-N: Execute turns
    // State is derived from step results (replay-safe — no mutable vars across steps)
    const turnResults: { message: ConversationMessage; terminated: boolean }[] = []

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const turnResult = (await step.run(`turn-${turn}`, async () => {
        // Decrypt keys fresh each turn — never serialized by Inngest
        const [employerApiKey, seekerApiKey] = await Promise.all([
          decrypt(ctx.employerKeyRef.encrypted, ctx.employerKeyRef.salt),
          decrypt(ctx.seekerKeyRef.encrypted, ctx.seekerKeyRef.salt),
        ])

        const orchestratorInput: OrchestratorInput = {
          posting: ctx.postingInput,
          candidate: ctx.candidateInput,
          opportunity: ctx.opportunityInput,
          seekerPrivateSettings: ctx.seekerPrivate,
          privateValues: ctx.privateVals,
          employerApiKey,
          employerProvider: ctx.employerProvider,
          seekerApiKey,
          seekerProvider: ctx.seekerProvider,
          maxTurns: MAX_TURNS,
          minTurnsBeforeDecision: MIN_TURNS_BEFORE_DECISION,
        }

        const employerAgentFn = makeEmployerAgentFn(ctx.postingInput, ctx.candidateInput)
        const seekerAgentFn = makeSeekerAgentFn(ctx.candidateInput, ctx.seekerPrivate)

        // Build messages from prior turn results (replay-safe)
        const messages = turnResults.map((r) => r.message)

        return runConversationTurn({
          input: orchestratorInput,
          turnNumber: turn,
          messages,
          employerAgent: employerAgentFn,
          seekerAgent: seekerAgentFn,
        })
      })) as { message: ConversationMessage; terminated: boolean; terminationReason?: string }

      turnResults.push(turnResult)

      // Persist messages after each turn
      const allMessages = turnResults.map((r) => r.message)
      await step.run(`persist-turn-${turn}`, async () => {
        await db.agentConversation.update({
          where: { id: conversation.id },
          data: { messages: allMessages as Prisma.InputJsonValue[] },
        })
      })

      if (turnResult.terminated) {
        break
      }

      // Derive decisions from accumulated messages (replay-safe)
      const lastEmployerMsg = [...allMessages].reverse().find((m) => m.role === "employer_agent")
      const lastSeekerMsg = [...allMessages].reverse().find((m) => m.role === "seeker_agent")
      const employerDecision = lastEmployerMsg?.decision ?? "CONTINUE"
      const seekerDecision = lastSeekerMsg?.decision ?? "CONTINUE"

      const terminationResult = shouldTerminate(
        employerDecision,
        seekerDecision,
        turn + 1,
        MIN_TURNS_BEFORE_DECISION,
        MAX_TURNS,
      )

      if (terminationResult) {
        break
      }
    }

    // Final step: derive status from accumulated results and finalize
    await step.run("finalize", async () => {
      const allMessages = turnResults.map((r) => r.message)
      const lastTurn = turnResults[turnResults.length - 1]

      // Determine final status from messages
      let finalStatus: "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | "TERMINATED" =
        "COMPLETED_NO_MATCH"

      if (lastTurn?.terminated) {
        finalStatus = "TERMINATED"
      } else {
        const lastEmployerMsg = [...allMessages].reverse().find((m) => m.role === "employer_agent")
        const lastSeekerMsg = [...allMessages].reverse().find((m) => m.role === "seeker_agent")
        const empDec = lastEmployerMsg?.decision ?? "CONTINUE"
        const seekDec = lastSeekerMsg?.decision ?? "CONTINUE"

        if (empDec === "MATCH" && seekDec === "MATCH") {
          finalStatus = "COMPLETED_MATCH"
        } else if (empDec === "NO_MATCH" || seekDec === "NO_MATCH") {
          finalStatus = "COMPLETED_NO_MATCH"
        }
      }

      const outcome =
        finalStatus === "COMPLETED_MATCH"
          ? `Mutual match at turn ${allMessages.length}`
          : finalStatus === "TERMINATED"
            ? `Terminated at turn ${allMessages.length}`
            : `No match after ${allMessages.length} turns`

      await db.agentConversation.update({
        where: { id: conversation.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          outcome: `${outcome}. LLM calls: ${allMessages.length}`,
          messages: allMessages as Prisma.InputJsonValue[],
        },
      })

      if (finalStatus === "COMPLETED_MATCH") {
        const confidence =
          allMessages.length <= 4
            ? ("STRONG" as const)
            : allMessages.length <= 7
              ? ("GOOD" as const)
              : ("POTENTIAL" as const)

        const lastMessages = allMessages.slice(-4)
        const summary = lastMessages.map((m) => m.content).join(" ")
        const matchSummary = summary.length > 500 ? summary.slice(0, 497) + "..." : summary

        await db.match.create({
          data: {
            conversationId: conversation.id,
            jobPostingId,
            seekerId,
            employerId,
            confidenceScore: confidence,
            matchSummary,
          },
        })
      }
    })

    const allMessages = turnResults.map((r) => r.message)
    const lastTurn = turnResults[turnResults.length - 1]
    const finalStatus = lastTurn?.terminated
      ? "TERMINATED"
      : (() => {
          const empMsg = [...allMessages].reverse().find((m) => m.role === "employer_agent")
          const seekMsg = [...allMessages].reverse().find((m) => m.role === "seeker_agent")
          return empMsg?.decision === "MATCH" && seekMsg?.decision === "MATCH"
            ? "COMPLETED_MATCH"
            : "COMPLETED_NO_MATCH"
        })()

    return {
      status: finalStatus,
      conversationId: conversation.id,
      totalTurns: allMessages.length,
      totalLlmCalls: allMessages.length,
    }
  }
}

// ---------------------------------------------------------------------------
// Inngest function registration
// ---------------------------------------------------------------------------

export const runAgentConversation = inngest.createFunction(
  {
    id: "run-agent-conversation",
    retries: 3,
    concurrency: [{ limit: CONCURRENCY_LIMIT, key: "event.data.jobPostingId" }, { limit: 200 }],
  },
  { event: "conversations/start" },
  buildConversationWorkflow(),
)
