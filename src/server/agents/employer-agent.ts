/**
 * Employer Agent — evaluates job seeker profiles against job postings.
 *
 * Uses Vercel AI SDK `generateObject` with Zod schema validation for
 * structured LLM output. Supports OpenAI and Anthropic via BYOK keys.
 *
 * @see .specify/specs/5-basic-ai-matching/spec.md
 */
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { agentEvaluationSchema, type AgentEvaluation } from "@/lib/matching-schemas"
import { buildSandboxBlock } from "./prompt-sandbox"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostingInput {
  title: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: string
  employmentType: string
  locationType: string
  locationReq: string | null
  salaryMin: number | null
  salaryMax: number | null
  benefits: string[]
  whyApply: string | null
}

export interface CandidateInput {
  name: string
  headline: string | null
  skills: string[]
  experience: unknown[]
  education: unknown[]
  location: string | null
  profileCompleteness: number
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function createProvider(provider: string, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey })
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })
  }
  throw new Error(`Unsupported provider: ${provider}`)
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI recruitment assistant evaluating job candidates for a specific role.

EVALUATION GUIDELINES:
- Evaluate the candidate ONLY on their skills, experience, qualifications, and role alignment.
- You MUST NOT consider or reference any protected characteristics including but not limited to: race, gender, age, disability, religion, national origin, sexual orientation, or marital status.
- Focus on objective fit between the candidate's demonstrated abilities and the job requirements.
- Be fair and balanced in your assessment.

SCORING GUIDE:
- 70-100 (STRONG): Excellent fit. Candidate meets most/all required skills and has relevant experience.
- 50-69 (GOOD): Solid fit. Candidate meets many requirements with some gaps.
- 30-49 (POTENTIAL): Partial fit. Candidate has some relevant skills but significant gaps.
- 0-29: Poor fit. Candidate lacks most required qualifications.

OUTPUT REQUIREMENTS:
- score: integer 0-100
- confidence: must match score band (STRONG for 70-100, GOOD for 50-69, POTENTIAL for 30-49)
- matchSummary: 2-4 sentence explanation of the match rationale
- strengthAreas: list of specific areas where the candidate excels for this role
- gapAreas: list of specific areas where the candidate falls short`

export function buildEvaluationPrompt(
  posting: PostingInput,
  candidate: CandidateInput,
): { system: string; prompt: string } {
  const prompt = `## Job Posting
${JSON.stringify(posting, null, 2)}

## Candidate Profile
${JSON.stringify(candidate, null, 2)}

Evaluate this candidate for the role above. Provide your assessment as a structured evaluation.`

  return { system: SYSTEM_PROMPT, prompt }
}

// ---------------------------------------------------------------------------
// Evaluation function
// ---------------------------------------------------------------------------

/**
 * Build the employer agent system prompt for conversation turns.
 * Optionally injects a custom prompt in a sandboxed section.
 */
export function buildEmployerSystemPrompt(phase: string, customPrompt?: string | null): string {
  let system = `You are an AI recruitment agent evaluating a candidate for a specific role.
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
- decision: CONTINUE (need more info), MATCH (recommend proceeding), or NO_MATCH (not a fit)
- evaluation: (REQUIRED when decision is MATCH or NO_MATCH) Structured evaluation with:
  - agentRole: "employer_agent"
  - overallScore: 0-100 assessment of overall fit
  - recommendation: "MATCH" or "NO_MATCH"
  - reasoning: 20-500 char explanation (qualitative terms, no exact figures)
  - dimensions: Array of 4-6 scored dimensions, each with name, score (0-100), and reasoning (10-200 chars).
    Dimension names: skills_alignment, experience_fit, compensation_alignment, work_arrangement, culture_fit, growth_potential`

  system += buildSandboxBlock(customPrompt)

  return system
}

export async function evaluateCandidate(
  posting: PostingInput,
  candidate: CandidateInput,
  apiKey: string,
  provider: string,
): Promise<AgentEvaluation | null> {
  try {
    const model = createProvider(provider, apiKey)
    const { system, prompt } = buildEvaluationPrompt(posting, candidate)

    const result = await generateObject({
      model: model(provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514"),
      schema: agentEvaluationSchema,
      system,
      prompt,
    })

    // Double-validate with Zod (generateObject should already validate, but belt-and-suspenders)
    const parsed = agentEvaluationSchema.safeParse(result.object)
    if (!parsed.success) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}
