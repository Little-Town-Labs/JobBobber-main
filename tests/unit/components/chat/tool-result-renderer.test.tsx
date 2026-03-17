// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { ToolResultRenderer } from "@/components/chat/tool-result-renderer"
import type {
  JobSearchResult,
  MatchResult,
  ProfileResult,
  PostingResult,
  CandidateResult,
} from "@/server/agents/chat-tools"

describe("ToolResultRenderer", () => {
  describe("searchJobs dispatch", () => {
    it("renders JobSearchCards for searchJobs tool", () => {
      const jobs: JobSearchResult[] = [
        {
          title: "Frontend Engineer",
          company: "Acme Corp",
          location: "Remote",
          locationType: "REMOTE",
          salaryMin: 80000,
          salaryMax: 120000,
          employmentType: "FULL_TIME",
          experienceLevel: "MID",
        },
      ]
      render(<ToolResultRenderer toolName="searchJobs" result={jobs} />)
      expect(screen.getByTestId("job-search-cards")).toBeInTheDocument()
      expect(screen.getByText("Frontend Engineer")).toBeInTheDocument()
      expect(screen.getByText("Acme Corp")).toBeInTheDocument()
    })

    it("handles empty job results", () => {
      render(<ToolResultRenderer toolName="searchJobs" result={[]} />)
      expect(screen.getByTestId("job-search-cards")).toBeInTheDocument()
      expect(screen.getByText("No results found")).toBeInTheDocument()
    })
  })

  describe("getMyMatches dispatch", () => {
    it("renders MatchSummaryTable for getMyMatches tool", () => {
      const matches: MatchResult[] = [
        {
          id: "m1",
          jobTitle: "Backend Dev",
          companyName: "TechCo",
          confidenceScore: "STRONG",
          seekerStatus: "PENDING",
          employerStatus: "ACCEPTED",
          matchSummary: "Great match based on skills",
        },
      ]
      render(<ToolResultRenderer toolName="getMyMatches" result={matches} />)
      expect(screen.getByTestId("match-summary-table")).toBeInTheDocument()
      expect(screen.getAllByText("Backend Dev @ TechCo")[0]).toBeInTheDocument()
    })
  })

  describe("getCandidates dispatch", () => {
    it("renders MatchSummaryTable for getCandidates tool", () => {
      const candidates: CandidateResult[] = [
        {
          matchId: "c1",
          candidateName: "Jane Doe",
          confidenceScore: "GOOD",
          matchSummary: "Skills align well",
          seekerStatus: "ACCEPTED",
          employerStatus: "PENDING",
        },
      ]
      render(<ToolResultRenderer toolName="getCandidates" result={candidates} />)
      expect(screen.getByTestId("match-summary-table")).toBeInTheDocument()
      expect(screen.getAllByText("Jane Doe")[0]).toBeInTheDocument()
    })
  })

  describe("getMyProfile dispatch", () => {
    it("renders ProfilePreviewCard for getMyProfile tool", () => {
      const profile: ProfileResult = {
        name: "John Smith",
        headline: "Senior Developer",
        skills: ["React", "TypeScript"],
        location: "NYC",
        profileCompleteness: 75,
        experienceCount: 3,
        educationCount: 2,
      }
      render(<ToolResultRenderer toolName="getMyProfile" result={profile} />)
      expect(screen.getByTestId("profile-preview-card")).toBeInTheDocument()
      expect(screen.getByText("John Smith")).toBeInTheDocument()
      expect(screen.getByText("React")).toBeInTheDocument()
    })

    it("handles null profile gracefully", () => {
      render(<ToolResultRenderer toolName="getMyProfile" result={null} />)
      expect(screen.getByTestId("profile-preview-card")).toBeInTheDocument()
      expect(screen.getByText("No profile data available")).toBeInTheDocument()
    })
  })

  describe("getMyPostings dispatch", () => {
    it("renders postings as a simple list", () => {
      const postings: PostingResult[] = [
        { id: "p1", title: "DevOps Lead", status: "ACTIVE", matchCount: 5 },
        { id: "p2", title: "Designer", status: "DRAFT", matchCount: 0 },
      ]
      render(<ToolResultRenderer toolName="getMyPostings" result={postings} />)
      expect(screen.getByTestId("postings-list")).toBeInTheDocument()
      expect(screen.getByText("DevOps Lead")).toBeInTheDocument()
      expect(screen.getByText("Designer")).toBeInTheDocument()
    })
  })

  describe("default fallback", () => {
    it("renders formatted JSON for unknown tool names", () => {
      const data = { foo: "bar", count: 42 }
      render(<ToolResultRenderer toolName="unknownTool" result={data} />)
      expect(screen.getByTestId("tool-result-fallback")).toBeInTheDocument()
      expect(screen.getByText(/"foo"/)).toBeInTheDocument()
    })

    it("renders fallback for undefined result", () => {
      render(<ToolResultRenderer toolName="unknownTool" result={undefined} />)
      expect(screen.getByTestId("tool-result-fallback")).toBeInTheDocument()
    })
  })
})
