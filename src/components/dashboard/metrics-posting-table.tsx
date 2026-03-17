"use client"

import { useState } from "react"
import { formatDuration } from "@/lib/metrics/format-duration"

interface PostingRow {
  id: string
  title: string
  status: string
  createdAt: Date | string
  firstMatchAt: Date | string | null
  firstMutualAcceptAt: Date | string | null
  timeToFirstMatchMs: number | null
  timeToMutualAcceptMs: number | null
  totalMatches: number
  totalAccepts: number
}

interface MetricsPostingTableProps {
  postings: PostingRow[]
  aggregates: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
  }
}

type SortKey =
  | "title"
  | "status"
  | "createdAt"
  | "timeToFirstMatchMs"
  | "timeToMutualAcceptMs"
  | "totalMatches"
  | "totalAccepts"
type SortDir = "asc" | "desc"

const COLUMN_HEADERS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created" },
  { key: "timeToFirstMatchMs", label: "Time to First Match" },
  { key: "timeToMutualAcceptMs", label: "Time to Mutual Accept" },
  { key: "totalMatches", label: "Matches" },
  { key: "totalAccepts", label: "Accepts" },
]

function getSortValue(posting: PostingRow, key: SortKey): string | number {
  switch (key) {
    case "title":
      return posting.title.toLowerCase()
    case "status":
      return posting.status
    case "createdAt":
      return new Date(posting.createdAt).getTime()
    case "timeToFirstMatchMs":
      return posting.timeToFirstMatchMs ?? Infinity
    case "timeToMutualAcceptMs":
      return posting.timeToMutualAcceptMs ?? Infinity
    case "totalMatches":
      return posting.totalMatches
    case "totalAccepts":
      return posting.totalAccepts
  }
}

function getRowHighlight(
  posting: PostingRow,
  avgFirstMatch: number | null,
  avgMutualAccept: number | null,
): string {
  if (posting.timeToFirstMatchMs === null) return ""

  const belowFirstMatch = avgFirstMatch !== null && posting.timeToFirstMatchMs < avgFirstMatch
  const aboveFirstMatch = avgFirstMatch !== null && posting.timeToFirstMatchMs > avgFirstMatch

  // If has mutual accept data, check both; otherwise just check first match
  if (posting.timeToMutualAcceptMs !== null && avgMutualAccept !== null) {
    const belowMutualAccept = posting.timeToMutualAcceptMs < avgMutualAccept
    const aboveMutualAccept = posting.timeToMutualAcceptMs > avgMutualAccept

    if (belowFirstMatch && belowMutualAccept) return "bg-green-50"
    if (aboveFirstMatch && aboveMutualAccept) return "bg-red-50"
  } else {
    // Only first match data — highlight based on that alone
    if (belowFirstMatch) return "bg-green-50"
    if (aboveFirstMatch) return "bg-red-50"
  }

  return ""
}

function formatDate(date: Date | string): string {
  return new Date(date).toISOString().split("T")[0]!
}

function formatTimeCell(ms: number | null, hasMatches: boolean): string {
  if (ms !== null) return formatDuration(ms) ?? "< 1 hour"
  if (!hasMatches) return "No matches yet"
  return "Pending"
}

export function MetricsPostingTable({ postings, aggregates }: MetricsPostingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  if (postings.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-gray-500">No postings in this time window.</p>
      </div>
    )
  }

  const sorted = [...postings].sort((a, b) => {
    const aVal = getSortValue(a, sortKey)
    const bVal = getSortValue(b, sortKey)

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    const aNum = aVal as number
    const bNum = bVal as number
    return sortDir === "asc" ? aNum - bNum : bNum - aNum
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "title" || key === "status" ? "asc" : "desc")
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            {COLUMN_HEADERS.map((col) => (
              <th
                key={col.key}
                className="cursor-pointer pb-2 pr-4 select-none hover:text-gray-900"
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((posting) => (
            <tr
              key={posting.id}
              className={`border-b last:border-0 ${getRowHighlight(
                posting,
                aggregates.avgTimeToFirstMatchMs,
                aggregates.avgTimeToMutualAcceptMs,
              )}`}
            >
              <td className="py-3 pr-4 font-medium">{posting.title}</td>
              <td className="py-3 pr-4">
                <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                  {posting.status}
                </span>
              </td>
              <td className="py-3 pr-4">{formatDate(posting.createdAt)}</td>
              <td className="py-3 pr-4">
                {formatTimeCell(posting.timeToFirstMatchMs, posting.totalMatches > 0)}
              </td>
              <td className="py-3 pr-4">
                {formatTimeCell(posting.timeToMutualAcceptMs, posting.totalMatches > 0)}
              </td>
              <td className="py-3 pr-4 text-right">{posting.totalMatches}</td>
              <td className="py-3 pr-4 text-right">{posting.totalAccepts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
