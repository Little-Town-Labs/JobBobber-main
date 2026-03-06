/**
 * Shared LLM mock factory for deterministic AI SDK testing.
 *
 * Produces configurable, Zod-valid responses matching agentEvaluationSchema.
 * Replaces ad-hoc vi.mock("ai") patterns across test files.
 *
 * @see tests/helpers/llm-mock.test.ts
 */
import type { AgentEvaluation } from "@/lib/matching-schemas"

type ErrorType = "rate_limit" | "timeout" | "invalid_key"

interface MockConfig {
  score?: number
  confidence?: "STRONG" | "GOOD" | "POTENTIAL"
  matchSummary?: string
  strengthAreas?: string[]
  gapAreas?: string[]
  error?: ErrorType
}

interface GenerateObjectArgs {
  model: string
  prompt?: string
  [key: string]: unknown
}

const DEFAULT_EVALUATION: AgentEvaluation = {
  score: 75,
  confidence: "STRONG",
  matchSummary:
    "The candidate demonstrates strong alignment with the role requirements and team culture.",
  strengthAreas: ["Relevant experience", "Technical skills match"],
  gapAreas: ["Minor gap in domain knowledge"],
}

const ERROR_MESSAGES: Record<ErrorType, string> = {
  rate_limit: "API rate limit exceeded",
  timeout: "Request timeout exceeded",
  invalid_key: "Invalid API key provided",
}

export function createMockGenerateObject(config?: MockConfig) {
  return async (args: GenerateObjectArgs) => {
    if (!args.model) {
      throw new Error("model identifier must be non-empty")
    }

    if (config?.error) {
      throw new Error(ERROR_MESSAGES[config.error])
    }

    const evaluation: AgentEvaluation = {
      ...DEFAULT_EVALUATION,
      ...(config?.score !== undefined ? { score: config.score } : {}),
      ...(config?.confidence ? { confidence: config.confidence } : {}),
      ...(config?.matchSummary ? { matchSummary: config.matchSummary } : {}),
      ...(config?.strengthAreas ? { strengthAreas: config.strengthAreas } : {}),
      ...(config?.gapAreas ? { gapAreas: config.gapAreas } : {}),
    }

    return { object: evaluation }
  }
}
