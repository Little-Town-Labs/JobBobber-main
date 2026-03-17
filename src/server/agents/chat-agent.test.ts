import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    employerMember: { findFirst: vi.fn() },
    seekerSettings: { findUnique: vi.fn() },
    match: { findMany: vi.fn() },
    jobPosting: { findMany: vi.fn() },
    agentConversation: { findMany: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { assembleChatContext, buildChatSystemPrompt } from "./chat-agent"

const mockDb = db as unknown as {
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  employer: { findUnique: ReturnType<typeof vi.fn> }
  employerMember: { findFirst: ReturnType<typeof vi.fn> }
  seekerSettings: { findUnique: ReturnType<typeof vi.fn> }
  match: { findMany: ReturnType<typeof vi.fn> }
  jobPosting: { findMany: ReturnType<typeof vi.fn> }
  agentConversation: { findMany: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// assembleChatContext — Seeker
// ---------------------------------------------------------------------------

describe("assembleChatContext (seeker)", () => {
  const seekerProfile = {
    id: "seeker_1",
    name: "Jane Doe",
    headline: "Full-Stack Developer",
    skills: ["TypeScript", "React", "Node.js"],
    experience: [{ title: "Dev", company: "Acme", startDate: "2020-01-01" }],
    education: [{ institution: "MIT", degree: "BS CS" }],
    location: "San Francisco",
    profileCompleteness: 0.85,
    bio: "I build things",
  }

  const seekerSettings = {
    minSalary: 120000,
    salaryRules: { type: "flexible" },
    dealBreakers: ["no remote"],
    priorities: ["work-life balance"],
    exclusions: ["BigCorp"],
    customPrompt: null,
  }

  const matches = [
    {
      id: "m1",
      confidenceScore: "STRONG",
      matchSummary: "Great fit for the role",
      seekerStatus: "PENDING",
      employerStatus: "ACCEPTED",
      jobPosting: { title: "Senior Engineer", employer: { name: "TechCo" } },
    },
  ]

  const conversations = [
    {
      id: "conv1",
      status: "COMPLETED_MATCH",
      outcome: "Matched",
      jobPosting: { title: "Senior Engineer" },
    },
  ]

  it("includes profile name, skills, and headline", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(seekerProfile)
    mockDb.seekerSettings.findUnique.mockResolvedValue(seekerSettings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "JOB_SEEKER")

    expect(ctx.userName).toBe("Jane Doe")
    expect(ctx.userRole).toBe("JOB_SEEKER")
    expect(ctx.profile).toMatchObject({
      headline: "Full-Stack Developer",
      skills: ["TypeScript", "React", "Node.js"],
      location: "San Francisco",
      profileCompleteness: 0.85,
    })
  })

  it("includes match summaries", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(seekerProfile)
    mockDb.seekerSettings.findUnique.mockResolvedValue(seekerSettings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "JOB_SEEKER")

    expect(ctx.matches).toHaveLength(1)
    expect(ctx.matches[0]).toMatchObject({
      confidenceScore: "STRONG",
      matchSummary: "Great fit for the role",
      jobTitle: "Senior Engineer",
    })
  })

  it("includes own private settings", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(seekerProfile)
    mockDb.seekerSettings.findUnique.mockResolvedValue(seekerSettings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "JOB_SEEKER")

    expect(ctx.privateSettings).toMatchObject({
      minSalary: 120000,
      dealBreakers: ["no remote"],
      priorities: ["work-life balance"],
    })
  })

  it("includes conversation summaries", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(seekerProfile)
    mockDb.seekerSettings.findUnique.mockResolvedValue(seekerSettings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "JOB_SEEKER")

    expect(ctx.conversationSummaries).toHaveLength(1)
    expect(ctx.conversationSummaries[0]).toMatchObject({
      status: "COMPLETED_MATCH",
      jobTitle: "Senior Engineer",
    })
  })

  it("returns empty arrays when no matches or conversations exist", async () => {
    mockDb.jobSeeker.findUnique.mockResolvedValue(seekerProfile)
    mockDb.seekerSettings.findUnique.mockResolvedValue(null)
    mockDb.match.findMany.mockResolvedValue([])
    mockDb.agentConversation.findMany.mockResolvedValue([])

    const ctx = await assembleChatContext(db, "clerk_user_1", "JOB_SEEKER")

    expect(ctx.matches).toEqual([])
    expect(ctx.conversationSummaries).toEqual([])
    expect(ctx.privateSettings).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// assembleChatContext — Employer
// ---------------------------------------------------------------------------

describe("assembleChatContext (employer)", () => {
  const employer = {
    id: "emp_1",
    clerkOrgId: "org_1",
    name: "TechCo",
    industry: "Technology",
    description: "We build software",
  }

  const postings = [
    {
      id: "post_1",
      title: "Senior Engineer",
      status: "ACTIVE",
      _count: { matches: 5 },
    },
    {
      id: "post_2",
      title: "Junior Dev",
      status: "DRAFT",
      _count: { matches: 0 },
    },
  ]

  const matches = [
    {
      id: "m1",
      confidenceScore: "GOOD",
      matchSummary: "Decent fit",
      seekerStatus: "PENDING",
      employerStatus: "PENDING",
      seeker: { name: "Candidate A" },
      jobPosting: { title: "Senior Engineer" },
    },
  ]

  const conversations = [
    {
      id: "conv1",
      status: "COMPLETED_NO_MATCH",
      outcome: "No match",
      jobPosting: { title: "Senior Engineer" },
    },
  ]

  it("includes company name and posting titles", async () => {
    mockDb.employerMember.findFirst.mockResolvedValue({ employer })
    mockDb.jobPosting.findMany.mockResolvedValue(postings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "EMPLOYER")

    expect(ctx.userName).toBe("TechCo")
    expect(ctx.userRole).toBe("EMPLOYER")
    expect(ctx.postings).toHaveLength(2)
    expect(ctx.postings![0]).toMatchObject({ title: "Senior Engineer", status: "ACTIVE" })
  })

  it("includes match counts per posting", async () => {
    mockDb.employerMember.findFirst.mockResolvedValue({ employer })
    mockDb.jobPosting.findMany.mockResolvedValue(postings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "EMPLOYER")

    expect(ctx.postings![0]).toHaveProperty("matchCount", 5)
  })

  it("never includes other users' private data", async () => {
    mockDb.employerMember.findFirst.mockResolvedValue({ employer })
    mockDb.jobPosting.findMany.mockResolvedValue(postings)
    mockDb.match.findMany.mockResolvedValue(matches)
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)

    const ctx = await assembleChatContext(db, "clerk_user_1", "EMPLOYER")

    // Employer context should not have privateSettings (that's seeker-only)
    expect(ctx.privateSettings).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildChatSystemPrompt
// ---------------------------------------------------------------------------

describe("buildChatSystemPrompt", () => {
  const seekerContext = {
    userName: "Jane Doe",
    userRole: "JOB_SEEKER" as const,
    profile: {
      headline: "Full-Stack Developer",
      skills: ["TypeScript", "React"],
      location: "San Francisco",
      profileCompleteness: 0.85,
      bio: "I build things",
    },
    matches: [
      {
        confidenceScore: "STRONG",
        matchSummary: "Great fit",
        seekerStatus: "PENDING",
        employerStatus: "ACCEPTED",
        jobTitle: "Senior Engineer",
        companyName: "TechCo",
      },
    ],
    privateSettings: {
      minSalary: 120000,
      dealBreakers: ["no remote"],
      priorities: ["work-life balance"],
    },
    conversationSummaries: [],
    postings: null,
  }

  it("contains JobBobber agent identification", () => {
    const prompt = buildChatSystemPrompt(seekerContext)
    expect(prompt).toMatch(/JobBobber/i)
    expect(prompt).toContain("personal JobBobber agent")
  })

  it("contains read-only instruction", () => {
    const prompt = buildChatSystemPrompt(seekerContext)
    expect(prompt).toMatch(/cannot.*action|read.only|information.*advice/i)
  })

  it("contains off-topic redirection instruction", () => {
    const prompt = buildChatSystemPrompt(seekerContext)
    expect(prompt).toMatch(/job.search|hiring|off.topic|redirect/i)
  })

  it("injects actual user data", () => {
    const prompt = buildChatSystemPrompt(seekerContext)
    expect(prompt).toContain("Jane Doe")
    expect(prompt).toContain("TypeScript")
    expect(prompt).toContain("1 match")
  })

  it("includes private settings for seekers", () => {
    const prompt = buildChatSystemPrompt(seekerContext)
    expect(prompt).toContain("120,000")
    expect(prompt).toContain("no remote")
  })

  it("includes posting info for employers", () => {
    const employerContext = {
      userName: "TechCo",
      userRole: "EMPLOYER" as const,
      profile: null,
      matches: [],
      privateSettings: null,
      conversationSummaries: [],
      postings: [{ title: "Senior Engineer", status: "ACTIVE", matchCount: 5 }],
    }

    const prompt = buildChatSystemPrompt(employerContext)
    expect(prompt).toContain("Senior Engineer")
    expect(prompt).toContain("5")
  })
})
