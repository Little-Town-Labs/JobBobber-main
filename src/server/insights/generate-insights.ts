/**
 * LLM-powered insight generation.
 *
 * Takes anonymized aggregate statistics and produces structured
 * strengths/weaknesses/recommendations via Vercel AI SDK.
 *
 * BYOK: Uses the user's own API key. Returns null if no key provided.
 */
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import {
  insightGenerationOutputSchema,
  type InsightGenerationInput,
  type InsightGenerationOutput,
} from "./insight-schemas"

const MAX_RETRIES = 3

function createModel(provider: string, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey })("gpt-4o-mini")
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })("claude-haiku-4-5-20251001")
  }
  throw new Error(`Unsupported provider: ${provider}`)
}

function buildPrompt(input: InsightGenerationInput): string {
  const role = input.userType === "JOB_SEEKER" ? "job seeker" : "employer"
  return [
    `You are a career insights advisor analyzing aggregate matching data for a ${role}.`,
    `Based on the following anonymized statistics, provide actionable feedback.`,
    ``,
    `Statistics:`,
    `- Total conversations: ${input.totalConversations}`,
    `- Matches: ${input.completedMatchCount}, No-matches: ${input.completedNoMatchCount}, Terminated: ${input.terminatedCount}`,
    `- Match rate: ${Math.round(input.matchRate * 100)}%`,
    `- Acceptance rate: ${Math.round(input.acceptanceRate * 100)}%`,
    `- Confidence distribution: Strong=${input.confidenceDistribution.STRONG}, Good=${input.confidenceDistribution.GOOD}, Potential=${input.confidenceDistribution.POTENTIAL}`,
    `- Recent trend: ${input.recentMatchRate > input.overallMatchRate ? "improving" : input.recentMatchRate < input.overallMatchRate ? "declining" : "stable"}`,
    `- Recent outcomes (last ${input.recentOutcomes.length}): ${input.recentOutcomes.join(", ") || "none"}`,
    ...(input.patternSummaries.length > 0
      ? [``, `Patterns observed:`, ...input.patternSummaries.map((p) => `- ${p}`)]
      : []),
    ``,
    `Provide constructive, actionable feedback. Be encouraging but honest.`,
    `Do not reference specific people, companies, or conversations.`,
    `Do not mention salary figures or private negotiation details.`,
  ].join("\n")
}

/**
 * Generate feedback insights from aggregate statistics using LLM.
 *
 * @returns Structured insights, or null if no API key or generation fails
 */
export async function generateFeedbackInsights(
  input: InsightGenerationInput,
  apiKey: string | null,
  provider: string | null,
): Promise<InsightGenerationOutput | null> {
  if (!apiKey || !provider) {
    return null
  }

  const model = createModel(provider, apiKey)
  const prompt = buildPrompt(input)

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: insightGenerationOutputSchema,
        prompt,
      })
      return result.object
    } catch {
      if (attempt === MAX_RETRIES - 1) {
        return null
      }
    }
  }

  return null
}
