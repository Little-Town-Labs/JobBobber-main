/**
 * Custom Prompts router — example prompts and dry-run validation.
 *
 * @see .specify/specs/15-custom-agent-prompting/spec.md
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { assertFlagEnabled, CUSTOM_PROMPTS } from "@/lib/flags"
import { validateCustomPrompt } from "@/server/agents/prompt-guard"

interface PromptExample {
  id: string
  title: string
  description: string
  prompt: string
  userType: "seeker" | "employer"
}

const SEEKER_EXAMPLES: PromptExample[] = [
  {
    id: "seeker-work-life",
    title: "Work-Life Balance Priority",
    description: "Emphasize remote work, flexible hours, and work-life balance over compensation.",
    prompt:
      "Prioritize work-life balance and remote work opportunities above compensation. Express strong interest in companies with flexible scheduling and remote-first cultures. Be willing to accept slightly lower pay for better work arrangement.",
    userType: "seeker",
  },
  {
    id: "seeker-salary-assertive",
    title: "Salary Assertive",
    description: "Be firm on salary expectations while remaining flexible on other terms.",
    prompt:
      "Be assertive on salary expectations but flexible on start date and other terms. If the compensation range doesn't meet expectations, express that clearly but diplomatically. Don't settle for below-market pay.",
    userType: "seeker",
  },
  {
    id: "seeker-career-change",
    title: "Career Change Emphasis",
    description: "Highlight transferable skills when pivoting from a different industry.",
    prompt:
      "Emphasize transferable skills and adaptability when evaluating opportunities. I'm transitioning from a different industry, so focus on how my existing skills apply rather than years of direct experience. Show enthusiasm for learning opportunities.",
    userType: "seeker",
  },
]

const EMPLOYER_EXAMPLES: PromptExample[] = [
  {
    id: "employer-culture-fit",
    title: "Culture Fit Priority",
    description: "Weight culture alignment more heavily than years of experience.",
    prompt:
      "Prioritize culture fit and growth mindset over strict years-of-experience requirements. A candidate who aligns with our values and shows eagerness to learn may be a better long-term investment than someone with more experience but less alignment.",
    userType: "employer",
  },
  {
    id: "employer-junior-growth",
    title: "Junior Role — Growth Potential",
    description: "Focus on potential and learning ability for entry-level positions.",
    prompt:
      "This is a junior role where growth potential matters most. Look for candidates who demonstrate curiosity, self-learning, and side projects rather than extensive professional experience. Bootcamp graduates and career changers are welcome.",
    userType: "employer",
  },
  {
    id: "employer-technical-depth",
    title: "Senior Role — Technical Depth",
    description: "Require deep technical expertise for senior engineering positions.",
    prompt:
      "This is a senior engineering role requiring deep technical expertise. Evaluate candidates rigorously on system design thinking, architecture experience, and demonstrated ability to mentor others. Years of experience alone don't qualify — look for depth.",
    userType: "employer",
  },
]

/** Get curated example prompts for a user type. */
export async function getExamples({
  input,
}: {
  input: { userType: "seeker" | "employer" }
}): Promise<PromptExample[]> {
  await assertFlagEnabled(CUSTOM_PROMPTS)
  return input.userType === "seeker" ? SEEKER_EXAMPLES : EMPLOYER_EXAMPLES
}

/** Validate a prompt for injection patterns (dry-run). */
export async function validatePrompt({
  input,
}: {
  input: { prompt: string }
}): Promise<{ valid: boolean; reason: string | null }> {
  await assertFlagEnabled(CUSTOM_PROMPTS)
  return validateCustomPrompt(input.prompt)
}

export const customPromptsRouter = createTRPCRouter({
  getExamples: protectedProcedure
    .input(z.object({ userType: z.enum(["seeker", "employer"]) }))
    .query(({ input }) => getExamples({ input })),

  validatePrompt: protectedProcedure
    .input(z.object({ prompt: z.string().max(2000) }))
    .mutation(({ input }) => validatePrompt({ input })),
})
