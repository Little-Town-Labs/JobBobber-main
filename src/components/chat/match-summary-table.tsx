"use client"

import type { MatchResult, CandidateResult } from "@/server/agents/chat-tools"

type MatchRow = {
  label: string
  confidenceScore: string
  seekerStatus: string
  employerStatus: string
}

interface MatchSummaryTableProps {
  data: MatchResult[] | CandidateResult[]
  variant: "matches" | "candidates"
}

function toRows(data: MatchResult[] | CandidateResult[], variant: string): MatchRow[] {
  return (data as Array<MatchResult | CandidateResult>).map((item) => {
    const label =
      variant === "candidates"
        ? (item as CandidateResult).candidateName
        : `${(item as MatchResult).jobTitle} @ ${(item as MatchResult).companyName}`
    return {
      label,
      confidenceScore: item.confidenceScore,
      seekerStatus: item.seekerStatus,
      employerStatus: item.employerStatus,
    }
  })
}

const badgeColors: Record<string, string> = {
  STRONG: "bg-green-100 text-green-800",
  GOOD: "bg-blue-100 text-blue-800",
  POTENTIAL: "bg-yellow-100 text-yellow-800",
}

function ConfidenceBadge({ score }: { score: string }) {
  const colors = badgeColors[score] ?? "bg-gray-100 text-gray-700"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {score}
    </span>
  )
}

export function MatchSummaryTable({ data, variant }: MatchSummaryTableProps) {
  const rows = toRows(data, variant)

  if (rows.length === 0) {
    return (
      <div data-testid="match-summary-table" className="py-3 text-sm text-gray-500">
        No {variant === "candidates" ? "candidates" : "matches"} found
      </div>
    )
  }

  const columnHeader = variant === "candidates" ? "Candidate" : "Job"

  return (
    <div data-testid="match-summary-table">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="pb-2 font-medium">{columnHeader}</th>
              <th className="pb-2 font-medium">Confidence</th>
              <th className="pb-2 font-medium">Your Status</th>
              <th className="pb-2 font-medium">Their Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 text-gray-900">{row.label}</td>
                <td className="py-2">
                  <ConfidenceBadge score={row.confidenceScore} />
                </td>
                <td className="py-2 text-gray-600">{row.seekerStatus}</td>
                <td className="py-2 text-gray-600">{row.employerStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-medium text-gray-900">{row.label}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <ConfidenceBadge score={row.confidenceScore} />
              <span>You: {row.seekerStatus}</span>
              <span>They: {row.employerStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
