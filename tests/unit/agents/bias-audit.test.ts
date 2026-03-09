/**
 * Task 7.1 — Bias audit tests for agent evaluation prompts.
 *
 * Validates that agent prompts do not contain proxy variables for protected
 * characteristics and that the prompt structure treats diverse candidates
 * equivalently.
 */
import { describe, it, expect } from "vitest"
import {
  buildEvaluationPrompt,
  type PostingInput,
  type CandidateInput,
} from "@/server/agents/employer-agent"
import {
  buildSeekerPrompt,
  type OpportunityInput,
  type SeekerProfileInput,
  type SeekerPrivateSettings,
} from "@/server/agents/seeker-agent"

// ---------------------------------------------------------------------------
// Proxy terms that should NOT appear in system prompts
// ---------------------------------------------------------------------------

const PROTECTED_CHARACTERISTIC_PROXIES = [
  // Race / ethnicity
  "race",
  "ethnicity",
  "skin color",
  "racial",
  "ethnic background",
  // Gender
  "gender identity",
  "sex",
  "masculine",
  "feminine",
  "pregnant",
  "maternity",
  // Age
  "years old",
  "age group",
  "generation",
  "millennial",
  "boomer",
  "gen z",
  "elderly",
  "young candidate",
  "old candidate",
  // Disability
  "disability",
  "handicap",
  "impairment",
  "wheelchair",
  // Religion
  "religious",
  "church",
  "mosque",
  "temple",
  "prayer",
  "faith background",
  // National origin
  "country of origin",
  "nationality",
  "immigration status",
  "visa status",
  "accent",
  "foreign",
  // Sexual orientation
  "sexual orientation",
  "sexuality",
  "heterosexual",
  "homosexual",
  // Marital status
  "marital status",
  "married",
  "single parent",
  "family status",
]

// These terms ARE acceptable because they appear in anti-bias instructions
const ACCEPTABLE_ANTI_BIAS_TERMS = [
  "protected characteristics",
  "race, gender, age, disability, religion, national origin",
  "sexual orientation",
  "marital status",
]

// ---------------------------------------------------------------------------
// Test fixtures: identical qualifications, diverse names
// ---------------------------------------------------------------------------

function makePostingFixture(): PostingInput {
  return {
    title: "Senior Software Engineer",
    description: "Build scalable backend services using TypeScript and PostgreSQL.",
    requiredSkills: ["TypeScript", "Node.js", "PostgreSQL"],
    preferredSkills: ["Docker", "Kubernetes"],
    experienceLevel: "Senior",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    locationReq: null,
    salaryMin: 120000,
    salaryMax: 180000,
    benefits: ["Health insurance", "401k"],
    whyApply: "Join a growing startup.",
  }
}

function makeCandidateFixture(name: string): CandidateInput {
  return {
    name,
    headline: "Senior Software Engineer with 8 years of experience",
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker"],
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Tech Corp",
        years: 5,
      },
      {
        title: "Software Engineer",
        company: "Startup Inc",
        years: 3,
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        school: "State University",
        year: 2016,
      },
    ],
    location: "San Francisco, CA",
    profileCompleteness: 100,
  }
}

function makeOpportunityFixture(): OpportunityInput {
  return {
    title: "Senior Software Engineer",
    description: "Build scalable backend services.",
    requiredSkills: ["TypeScript", "Node.js"],
    experienceLevel: "Senior",
    employmentType: "FULL_TIME",
    locationType: "REMOTE",
    salaryMin: 120000,
    salaryMax: 180000,
    benefits: ["Health insurance"],
  }
}

function makeSeekerProfileFixture(name: string): SeekerProfileInput {
  return {
    name,
    headline: "Senior Software Engineer",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    experience: [{ title: "Senior Engineer", company: "Tech Corp", years: 5 }],
    education: [{ degree: "B.S. Computer Science", school: "State University" }],
    location: "San Francisco, CA",
  }
}

function makePrivateSettingsFixture(): SeekerPrivateSettings {
  return {
    minSalary: 120000,
    dealBreakers: ["No relocation"],
    priorities: ["Compensation", "Remote work"],
    exclusions: [],
  }
}

// Diverse name set — representing various demographic backgrounds
const DIVERSE_NAMES = [
  "James Smith",
  "Maria Garcia",
  "Wei Chen",
  "Amara Okafor",
  "Priya Patel",
  "Mohammed Al-Rashid",
  "Sarah Johnson",
  "Hiroshi Tanaka",
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bias Audit — Employer Agent Prompts", () => {
  it("system prompt does not contain proxy variables for protected characteristics", () => {
    const posting = makePostingFixture()
    const candidate = makeCandidateFixture("Test User")
    const { system } = buildEvaluationPrompt(posting, candidate)

    for (const proxy of PROTECTED_CHARACTERISTIC_PROXIES) {
      const lowerSystem = system.toLowerCase()
      const lowerProxy = proxy.toLowerCase()

      // Skip terms that appear as part of anti-bias instructions
      const isAntibiasContext = ACCEPTABLE_ANTI_BIAS_TERMS.some(
        (acceptable) =>
          lowerSystem.includes(acceptable.toLowerCase()) &&
          acceptable.toLowerCase().includes(lowerProxy),
      )

      if (!isAntibiasContext) {
        expect(lowerSystem).not.toContain(lowerProxy)
      }
    }
  })

  it("system prompt explicitly prohibits considering protected characteristics", () => {
    const posting = makePostingFixture()
    const candidate = makeCandidateFixture("Test User")
    const { system } = buildEvaluationPrompt(posting, candidate)

    expect(system).toContain("MUST NOT consider or reference")
    expect(system).toContain("protected characteristics")
  })

  it("system prompt instructs evaluation on skills and experience only", () => {
    const posting = makePostingFixture()
    const candidate = makeCandidateFixture("Test User")
    const { system } = buildEvaluationPrompt(posting, candidate)

    expect(system).toContain("skills")
    expect(system).toContain("experience")
    expect(system).toContain("qualifications")
  })

  it("produces structurally identical prompts for diverse candidate names", () => {
    const posting = makePostingFixture()

    const prompts = DIVERSE_NAMES.map((name) => {
      const candidate = makeCandidateFixture(name)
      return buildEvaluationPrompt(posting, candidate)
    })

    // All system prompts should be identical (name is in user prompt, not system)
    const systemPrompts = prompts.map((p) => p.system)
    const uniqueSystems = new Set(systemPrompts)
    expect(uniqueSystems.size).toBe(1)

    // User prompts should differ only in name
    for (let i = 0; i < prompts.length; i++) {
      const normalized = prompts[i]!.prompt.replace(DIVERSE_NAMES[i]!, "CANDIDATE_NAME")
      const referenceNormalized = prompts[0]!.prompt.replace(DIVERSE_NAMES[0]!, "CANDIDATE_NAME")
      expect(normalized).toBe(referenceNormalized)
    }
  })
})

describe("Bias Audit — Seeker Agent Prompts", () => {
  it("system prompt does not contain proxy variables for protected characteristics", () => {
    const opportunity = makeOpportunityFixture()
    const profile = makeSeekerProfileFixture("Test User")
    const settings = makePrivateSettingsFixture()
    const { system } = buildSeekerPrompt(opportunity, profile, settings)

    for (const proxy of PROTECTED_CHARACTERISTIC_PROXIES) {
      const lowerSystem = system.toLowerCase()
      const lowerProxy = proxy.toLowerCase()

      const isAntibiasContext = ACCEPTABLE_ANTI_BIAS_TERMS.some(
        (acceptable) =>
          lowerSystem.includes(acceptable.toLowerCase()) &&
          acceptable.toLowerCase().includes(lowerProxy),
      )

      if (!isAntibiasContext) {
        expect(lowerSystem).not.toContain(lowerProxy)
      }
    }
  })

  it("system prompt explicitly prohibits considering protected characteristics", () => {
    const opportunity = makeOpportunityFixture()
    const profile = makeSeekerProfileFixture("Test User")
    const settings = makePrivateSettingsFixture()
    const { system } = buildSeekerPrompt(opportunity, profile, settings)

    expect(system).toContain("MUST NOT consider or reference")
    expect(system).toContain("protected characteristics")
  })

  it("produces structurally identical system prompts for diverse names", () => {
    const opportunity = makeOpportunityFixture()
    const settings = makePrivateSettingsFixture()

    const systemPrompts = DIVERSE_NAMES.map((name) => {
      const profile = makeSeekerProfileFixture(name)
      return buildSeekerPrompt(opportunity, profile, settings).system
    })

    // System prompts should be identical — name is not in system prompt
    const uniqueSystems = new Set(systemPrompts)
    expect(uniqueSystems.size).toBe(1)
  })

  it("user prompts differ only by name for identical qualifications", () => {
    const opportunity = makeOpportunityFixture()
    const settings = makePrivateSettingsFixture()

    const prompts = DIVERSE_NAMES.map((name) => {
      const profile = makeSeekerProfileFixture(name)
      return buildSeekerPrompt(opportunity, profile, settings)
    })

    for (let i = 0; i < prompts.length; i++) {
      const normalized = prompts[i]!.prompt.replace(DIVERSE_NAMES[i]!, "CANDIDATE_NAME")
      const referenceNormalized = prompts[0]!.prompt.replace(DIVERSE_NAMES[0]!, "CANDIDATE_NAME")
      expect(normalized).toBe(referenceNormalized)
    }
  })
})
