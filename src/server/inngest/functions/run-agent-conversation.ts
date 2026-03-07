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

      // Decrypt keys
      const employerApiKey = await decrypt(employer.byokApiKeyEncrypted, employer.id)
      const seekerApiKey = await decrypt(
        seekerSettings.byokApiKeyEncrypted,
        seekerSettings.seekerId,
      )

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
        employerApiKey,
        employerProvider: employer.byokProvider,
        seekerApiKey,
        seekerProvider: seekerSettings.byokProvider,
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
      employerApiKey: string
      employerProvider: string
      seekerApiKey: string
      seekerProvider: string
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
    const messages: ConversationMessage[] = []
    let lastEmployerDecision: "MATCH" | "NO_MATCH" | "CONTINUE" = "CONTINUE"
    let lastSeekerDecision: "MATCH" | "NO_MATCH" | "CONTINUE" = "CONTINUE"
    let finalStatus: "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | "TERMINATED" = "COMPLETED_NO_MATCH"
    let totalLlmCalls = 0

    const orchestratorInput: OrchestratorInput = {
      posting: ctx.postingInput,
      candidate: ctx.candidateInput,
      opportunity: ctx.opportunityInput,
      seekerPrivateSettings: ctx.seekerPrivate,
      privateValues: ctx.privateVals,
      employerApiKey: ctx.employerApiKey,
      employerProvider: ctx.employerProvider,
      seekerApiKey: ctx.seekerApiKey,
      seekerProvider: ctx.seekerProvider,
      maxTurns: MAX_TURNS,
      minTurnsBeforeDecision: MIN_TURNS_BEFORE_DECISION,
    }

    const employerAgentFn = makeEmployerAgentFn(ctx.postingInput, ctx.candidateInput)
    const seekerAgentFn = makeSeekerAgentFn(ctx.candidateInput, ctx.seekerPrivate)

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const turnResult = (await step.run(`turn-${turn}`, async () => {
        return runConversationTurn({
          input: orchestratorInput,
          turnNumber: turn,
          messages,
          employerAgent: employerAgentFn,
          seekerAgent: seekerAgentFn,
        })
      })) as { message: ConversationMessage; terminated: boolean; terminationReason?: string }

      totalLlmCalls++
      messages.push(turnResult.message)

      // Persist messages after each turn
      await step.run(`persist-turn-${turn}`, async () => {
        await db.agentConversation.update({
          where: { id: conversation.id },
          data: { messages: messages as unknown[] },
        })
      })

      if (turnResult.terminated) {
        finalStatus = "TERMINATED"
        break
      }

      // Track decisions
      if (turnResult.message.role === "employer_agent" && turnResult.message.decision) {
        lastEmployerDecision = turnResult.message.decision
      }
      if (turnResult.message.role === "seeker_agent" && turnResult.message.decision) {
        lastSeekerDecision = turnResult.message.decision
      }

      // Check termination
      const terminationResult = shouldTerminate(
        lastEmployerDecision,
        lastSeekerDecision,
        turn + 1,
        MIN_TURNS_BEFORE_DECISION,
        MAX_TURNS,
      )

      if (terminationResult) {
        finalStatus = terminationResult
        break
      }
    }

    // Final step: Update conversation and optionally create match
    await step.run("finalize", async () => {
      const outcome =
        finalStatus === "COMPLETED_MATCH"
          ? `Mutual match at turn ${messages.length}`
          : finalStatus === "TERMINATED"
            ? `Terminated at turn ${messages.length}`
            : `No match after ${messages.length} turns`

      await db.agentConversation.update({
        where: { id: conversation.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          outcome: `${outcome}. LLM calls: ${totalLlmCalls}`,
          messages: messages as unknown[],
        },
      })

      if (finalStatus === "COMPLETED_MATCH") {
        // Derive confidence from conversation length
        const confidence =
          messages.length <= 4
            ? ("STRONG" as const)
            : messages.length <= 7
              ? ("GOOD" as const)
              : ("POTENTIAL" as const)

        const lastMessages = messages.slice(-4)
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

    return {
      status: finalStatus,
      conversationId: conversation.id,
      totalTurns: messages.length,
      totalLlmCalls,
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
    concurrency: [{ limit: CONCURRENCY_LIMIT, key: "event.data.jobPostingId" }],
  },
  { event: "conversations/start" },
  buildConversationWorkflow(),
)
