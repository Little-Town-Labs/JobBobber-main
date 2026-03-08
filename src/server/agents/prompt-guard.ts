/**
 * Prompt injection detection for custom agent prompts.
 *
 * Defense-in-depth layer: scans user-provided prompts for known
 * adversarial patterns before saving. The primary defense is the
 * sandbox framing in the agent system prompt.
 *
 * @see .specify/specs/15-custom-agent-prompting/plan.md — TD-1
 */

interface ValidationResult {
  valid: boolean
  reason: string | null
}

/** Patterns that indicate prompt injection attempts */
const INJECTION_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  // Role override
  { regex: /ignore\s+(all\s+)?previous\s+instructions/i, category: "instruction_override" },
  { regex: /you\s+are\s+now/i, category: "role_reassignment" },
  { regex: /new\s+instructions?:/i, category: "instruction_override" },

  // System prompt extraction
  { regex: /repeat\s+(your\s+)?system\s+prompt/i, category: "prompt_extraction" },
  { regex: /what\s+are\s+your\s+instructions/i, category: "prompt_extraction" },
  { regex: /show\s+me\s+your\s+prompt/i, category: "prompt_extraction" },

  // Delimiter injection
  { regex: /<\/?user-customization>/i, category: "delimiter_injection" },
  { regex: /<\/system>/i, category: "delimiter_injection" },
  { regex: /```system/i, category: "delimiter_injection" },

  // Override patterns
  { regex: /disregard\s+(all\s+)?prior/i, category: "instruction_override" },
  { regex: /override\s+(all\s+)?rules/i, category: "instruction_override" },
  { regex: /forget\s+(everything|all)/i, category: "instruction_override" },
]

/** User-friendly messages by category (never reveals detection rules) */
const CATEGORY_MESSAGES: Record<string, string> = {
  instruction_override:
    "Your prompt contains language that could interfere with the agent's core behavior. Please rephrase to describe your preferences without attempting to change the agent's fundamental instructions.",
  role_reassignment:
    "Your prompt appears to redefine the agent's role. Please describe your preferences in terms of what you'd like the agent to prioritize, not what it should become.",
  prompt_extraction:
    "Your prompt requests internal system information. Please focus on describing your preferences and priorities for the agent's evaluation behavior.",
  delimiter_injection:
    "Your prompt contains formatting that could interfere with the agent's operation. Please use plain text to describe your preferences.",
}

/**
 * Validate a custom prompt for injection patterns.
 *
 * @returns `{ valid: true, reason: null }` for safe prompts,
 *          `{ valid: false, reason: "..." }` for detected injections
 */
export function validateCustomPrompt(prompt: string): ValidationResult {
  // Empty or whitespace-only prompts are valid (treated as "no custom prompt")
  if (!prompt || prompt.trim().length === 0) {
    return { valid: true, reason: null }
  }

  for (const { regex, category } of INJECTION_PATTERNS) {
    if (regex.test(prompt)) {
      return {
        valid: false,
        reason:
          CATEGORY_MESSAGES[category] ??
          "Your prompt could not be validated. Please try rephrasing.",
      }
    }
  }

  return { valid: true, reason: null }
}
