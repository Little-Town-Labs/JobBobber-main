"use client"

import type { JobSearchResult } from "@/server/agents/chat-tools"

interface JobSearchCardsProps {
  results: JobSearchResult[]
}

function formatSalary(min: number | null, max: number | null): string {
  if (min === null && max === null) return "\u2014"
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`
  if (min !== null && max !== null) return `${fmt(min)} \u2013 ${fmt(max)}`
  if (min !== null) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

function formatEmploymentType(type: string): string {
  const map: Record<string, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACT: "Contract",
  }
  return map[type] ?? type
}

export function JobSearchCards({ results }: JobSearchCardsProps) {
  if (results.length === 0) {
    return (
      <div data-testid="job-search-cards" className="py-3 text-sm text-gray-500">
        No results found
      </div>
    )
  }

  return (
    <div data-testid="job-search-cards" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {results.map((job, i) => (
        <div
          key={`${job.title}-${job.company}-${i}`}
          data-testid="job-card"
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-gray-900">{job.title}</h3>
          <p className="mt-0.5 text-xs text-gray-600">{job.company}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>{job.location ?? "\u2014"}</span>
            <span className="text-gray-300">|</span>
            <span>{formatEmploymentType(job.employmentType)}</span>
            <span className="text-gray-300">|</span>
            <span>{job.experienceLevel}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-gray-700">
            {formatSalary(job.salaryMin, job.salaryMax)}
          </p>
        </div>
      ))}
    </div>
  )
}
