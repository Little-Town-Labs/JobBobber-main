/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    jobPosting: { findMany: vi.fn(), findFirst: vi.fn() },
    match: { findMany: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    agentConversation: { findMany: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { buildSeekerTools, buildEmployerTools } from "./chat-tools"

const mockDb = db as unknown as {
  jobPosting: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> }
  match: { findMany: ReturnType<typeof vi.fn> }
  jobSeeker: { findUnique: ReturnType<typeof vi.fn> }
  agentConversation: { findMany: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Seeker Tools
// ---------------------------------------------------------------------------

describe("buildSeekerTools", () => {
  const tools = buildSeekerTools(db, "seeker_1")

  describe("searchJobs", () => {
    it("returns matching postings with details", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([
        {
          title: "Senior Engineer",
          locationType: "REMOTE",
          locationReq: "Remote",
          salaryMin: 100000,
          salaryMax: 150000,
          employmentType: "FULL_TIME",
          experienceLevel: "SENIOR",
          employer: { name: "TechCo" },
        },
      ])

      const result: any = await tools.searchJobs.execute!(
        { query: "engineer", location: undefined, employmentType: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        title: "Senior Engineer",
        company: "TechCo",
        salaryMin: 100000,
      })
    })

    it("returns max 10 results", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])

      await tools.searchJobs.execute!(
        { query: "dev", location: undefined, employmentType: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      const call = mockDb.jobPosting.findMany.mock.calls[0]![0]
      expect(call.take).toBe(10)
    })

    it("returns empty array when no matches", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])

      const result: any = await tools.searchJobs.execute!(
        { query: "nonexistent", location: undefined, employmentType: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toEqual([])
    })
  })

  describe("getMyMatches", () => {
    it("returns seeker's matches with confidence and status", async () => {
      mockDb.match.findMany.mockResolvedValue([
        {
          id: "m1",
          confidenceScore: "STRONG",
          seekerStatus: "PENDING",
          employerStatus: "ACCEPTED",
          matchSummary: "Great fit for the role with strong TypeScript skills",
          jobPosting: { title: "Engineer", employer: { name: "Acme" } },
        },
      ])

      const result: any = await tools.getMyMatches.execute!(
        { status: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        jobTitle: "Engineer",
        companyName: "Acme",
        confidenceScore: "STRONG",
        seekerStatus: "PENDING",
      })
    })

    it("filters by seekerId (no cross-user access)", async () => {
      mockDb.match.findMany.mockResolvedValue([])

      await tools.getMyMatches.execute!(
        { status: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      const call = mockDb.match.findMany.mock.calls[0]![0]
      expect(call.where.seekerId).toBe("seeker_1")
    })
  })

  describe("getMyProfile", () => {
    it("returns current profile data", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({
        name: "Jane Doe",
        headline: "Developer",
        skills: ["TypeScript", "React"],
        location: "SF",
        profileCompleteness: 0.85,
        experience: [{ title: "Dev" }],
        education: [{ degree: "BS" }],
      })

      const result: any = await tools.getMyProfile.execute!(
        {},
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toMatchObject({
        name: "Jane Doe",
        skills: ["TypeScript", "React"],
        profileCompleteness: 0.85,
        experienceCount: 1,
        educationCount: 1,
      })
    })
  })

  describe("getConversationSummary", () => {
    it("returns conversation outcome for specified company", async () => {
      mockDb.agentConversation.findMany.mockResolvedValue([
        {
          status: "COMPLETED_MATCH",
          outcome: "Matched — strong alignment",
          startedAt: new Date("2026-03-01"),
          jobPosting: { title: "Engineer", employer: { name: "TechCo" } },
        },
      ])

      const result: any = await tools.getConversationSummary.execute!(
        { companyOrTitle: "TechCo" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toMatchObject({
        jobTitle: "Engineer",
        status: "COMPLETED_MATCH",
        outcome: "Matched — strong alignment",
      })
    })

    it("returns null when no conversation found", async () => {
      mockDb.agentConversation.findMany.mockResolvedValue([])

      const result: any = await tools.getConversationSummary.execute!(
        { companyOrTitle: "UnknownCorp" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// Employer Tools
// ---------------------------------------------------------------------------

describe("buildEmployerTools", () => {
  const tools = buildEmployerTools(db, "emp_1")

  describe("getCandidates", () => {
    it("returns candidates for a specific posting with scores", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue({ id: "post_1" })
      mockDb.match.findMany.mockResolvedValue([
        {
          id: "m1",
          confidenceScore: "GOOD",
          matchSummary: "Decent fit with relevant experience",
          seekerStatus: "PENDING",
          employerStatus: "PENDING",
          seeker: { name: "Candidate A" },
        },
      ])

      const result: any = await tools.getCandidates.execute!(
        { postingTitle: "Engineer" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        candidateName: "Candidate A",
        confidenceScore: "GOOD",
      })
    })

    it("does NOT return candidates from other employers' postings", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue({ id: "post_1" })
      mockDb.match.findMany.mockResolvedValue([])

      await tools.getCandidates.execute!(
        { postingTitle: "Engineer" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      const matchCall = mockDb.match.findMany.mock.calls[0]![0]
      expect(matchCall.where.employerId).toBe("emp_1")
    })
  })

  describe("getMyPostings", () => {
    it("returns employer's postings with match counts", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([
        { id: "p1", title: "Engineer", status: "ACTIVE", _count: { matches: 5 } },
        { id: "p2", title: "Designer", status: "DRAFT", _count: { matches: 0 } },
      ])

      const result: any = await tools.getMyPostings.execute!(
        { status: undefined },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ title: "Engineer", matchCount: 5 })
    })
  })

  describe("getPostingDetails", () => {
    it("returns full posting details for owned posting", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue({
        title: "Engineer",
        description: "Build cool stuff",
        requiredSkills: ["TS"],
        preferredSkills: ["React"],
        experienceLevel: "SENIOR",
        employmentType: "FULL_TIME",
        locationType: "REMOTE",
        salaryMin: 100000,
        salaryMax: 150000,
        status: "ACTIVE",
        _count: { matches: 3 },
      })

      const result: any = await tools.getPostingDetails.execute!(
        { postingTitle: "Engineer" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toMatchObject({
        title: "Engineer",
        requiredSkills: ["TS"],
        matchCount: 3,
      })
    })

    it("returns null for non-existent posting", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue(null)

      const result: any = await tools.getPostingDetails.execute!(
        { postingTitle: "Nonexistent" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toBeNull()
    })

    it("scopes query to employer's postings only", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue(null)

      await tools.getPostingDetails.execute!(
        { postingTitle: "Engineer" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      const call = mockDb.jobPosting.findFirst.mock.calls[0]![0]
      expect(call.where.employerId).toBe("emp_1")
    })
  })

  describe("getConversationSummary", () => {
    it("returns conversations scoped to employer's postings", async () => {
      mockDb.jobPosting.findFirst.mockResolvedValue({ id: "post_1" })
      mockDb.agentConversation.findMany.mockResolvedValue([
        {
          status: "COMPLETED_NO_MATCH",
          outcome: "No match",
          startedAt: new Date("2026-03-01"),
          jobPosting: { title: "Engineer" },
        },
      ])

      const result: any = await tools.getConversationSummary.execute!(
        { postingTitle: "Engineer" },
        { toolCallId: "tc1", messages: [], abortSignal: undefined as never },
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ status: "COMPLETED_NO_MATCH" })
    })
  })
})
