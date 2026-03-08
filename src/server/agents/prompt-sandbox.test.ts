/**
 * Task 3.1 — Agent Prompt Sandbox Injection Tests
 *
 * Tests that custom prompts are correctly injected into agent
 * system prompts within a sandboxed section, and that guardrails
 * are preserved.
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

const { buildSeekerPrompt } = await import("./seeker-agent")

describe("Seeker Agent — Custom Prompt Sandbox", () => {
  const baseProfile = {
    name: "Test User",
    headline: "Engineer",
    skills: ["TypeScript"],
    experience: [],
    education: [],
    location: "Remote",
  }

  const baseOpportunity = {
    title: "Senior Engineer",
    description: "Build things",
    requiredSkills: ["TypeScript"],
    experienceLevel: "SENIOR",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    salaryMin: 100000,
    salaryMax: 150000,
    benefits: [],
  }

  const baseSettings = {
    minSalary: 120000,
    dealBreakers: [],
    priorities: ["remote work"],
    exclusions: [],
  }

  it("includes <user-customization> block when customPrompt is provided", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      "Be assertive on salary",
    )

    expect(system).toContain("<user-customization>")
    expect(system).toContain("</user-customization>")
    expect(system).toContain("Be assertive on salary")
  })

  it("omits sandbox section when customPrompt is null", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      null,
    )

    expect(system).not.toContain("<user-customization>")
    expect(system).not.toContain("</user-customization>")
  })

  it("omits sandbox section when customPrompt is undefined", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
    )

    expect(system).not.toContain("<user-customization>")
  })

  it("omits sandbox section when customPrompt is whitespace-only", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      "   \n\t  ",
    )

    expect(system).not.toContain("<user-customization>")
  })

  it("sandbox appears AFTER core guardrails", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      "My custom prompt",
    )

    const guardrailIndex = system.indexOf("PRIVACY RULES")
    const sandboxIndex = system.indexOf("<user-customization>")
    expect(guardrailIndex).toBeGreaterThan(-1)
    expect(sandboxIndex).toBeGreaterThan(guardrailIndex)
  })

  it("sandbox framing text warns LLM about user-provided content", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      "Custom text here",
    )

    expect(system).toContain("user-provided")
    expect(system).toContain("CANNOT override")
  })

  it("core guardrails still present when custom prompt is set", () => {
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      "My preferences",
    )

    expect(system).toContain("EVALUATION GUIDELINES")
    expect(system).toContain("PRIVACY RULES")
    expect(system).toContain("MUST NOT consider or reference")
    expect(system).toContain("must NOT disclose exact salary figures")
  })

  it("injects full 2000-char prompt without truncation", () => {
    const longPrompt = "x".repeat(2000)
    const { system } = buildSeekerPrompt(
      baseOpportunity,
      baseProfile,
      baseSettings,
      [],
      "discovery",
      longPrompt,
    )

    expect(system).toContain(longPrompt)
  })
})

describe("Employer Agent — Custom Prompt Sandbox", () => {
  it("includes sandbox when customPrompt is provided (via buildEmployerSystemPrompt)", async () => {
    const { buildEmployerSystemPrompt } = await import("./employer-agent")

    const system = buildEmployerSystemPrompt("negotiation", "Focus on technical depth")

    expect(system).toContain("<user-customization>")
    expect(system).toContain("Focus on technical depth")
    expect(system).toContain("CANNOT override")
  })

  it("omits sandbox when customPrompt is null", async () => {
    const { buildEmployerSystemPrompt } = await import("./employer-agent")

    const system = buildEmployerSystemPrompt("negotiation", null)

    expect(system).not.toContain("<user-customization>")
  })

  it("omits sandbox when customPrompt is undefined", async () => {
    const { buildEmployerSystemPrompt } = await import("./employer-agent")

    const system = buildEmployerSystemPrompt("negotiation")

    expect(system).not.toContain("<user-customization>")
  })

  it("core guardrails preserved with custom prompt", async () => {
    const { buildEmployerSystemPrompt } = await import("./employer-agent")

    const system = buildEmployerSystemPrompt("screening", "Prioritize culture fit")

    expect(system).toContain("EVALUATION GUIDELINES")
    expect(system).toContain("PRIVACY RULES")
    expect(system).toContain("MUST NOT consider or reference protected characteristics")
  })
})
