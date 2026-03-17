"use client"

import type {
  JobSearchResult,
  MatchResult,
  ProfileResult,
  PostingResult,
  CandidateResult,
} from "@/server/agents/chat-tools"
import { JobSearchCards } from "./job-search-cards"
import { MatchSummaryTable } from "./match-summary-table"
import { ProfilePreviewCard } from "./profile-preview-card"

interface ToolResultRendererProps {
  toolName: string
  result: unknown
}

function PostingsList({ postings }: { postings: PostingResult[] }) {
  if (postings.length === 0) {
    return (
      <div data-testid="postings-list" className="py-3 text-sm text-gray-500">
        No postings found
      </div>
    )
  }

  return (
    <div data-testid="postings-list" className="space-y-1.5">
      {postings.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <span className="font-medium text-gray-900">{p.title}</span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2 py-0.5">{p.status}</span>
            <span>
              {p.matchCount} match{p.matchCount !== 1 ? "es" : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function JsonFallback({ data }: { data: unknown }) {
  const formatted = data !== undefined ? JSON.stringify(data, null, 2) : "No data"
  return (
    <pre
      data-testid="tool-result-fallback"
      className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700"
    >
      {formatted}
    </pre>
  )
}

export function ToolResultRenderer({ toolName, result }: ToolResultRendererProps) {
  switch (toolName) {
    case "searchJobs":
      return <JobSearchCards results={(result as JobSearchResult[]) ?? []} />

    case "getMyMatches":
      return <MatchSummaryTable data={(result as MatchResult[]) ?? []} variant="matches" />

    case "getCandidates":
      return <MatchSummaryTable data={(result as CandidateResult[]) ?? []} variant="candidates" />

    case "getMyProfile":
      return <ProfilePreviewCard profile={result as ProfileResult | null} />

    case "getMyPostings":
      return <PostingsList postings={(result as PostingResult[]) ?? []} />

    default:
      return <JsonFallback data={result} />
  }
}
