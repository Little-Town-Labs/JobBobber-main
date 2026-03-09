/**
 * CSV export utility for match data.
 *
 * Client-side generation using Blob API — no server-side file management.
 * Only exports allowed fields per NFR-2 (no private params or salary data).
 *
 * @see .specify/specs/17-advanced-employer-dashboard/spec.md
 */

interface MatchForCsv {
  seekerName: string
  confidenceScore: string
  employerStatus: string
  postingTitle: string
  createdAt: string
}

const HEADERS = ["Name", "Confidence", "Status", "Posting", "Date"]

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convert match objects to a CSV string.
 * Only includes allowed public fields — no private data.
 */
export function generateMatchCsv(matches: MatchForCsv[]): string {
  const header = HEADERS.join(",")

  if (matches.length === 0) return header

  const rows = matches.map((m) =>
    [
      escapeCsvField(m.seekerName),
      escapeCsvField(m.confidenceScore),
      escapeCsvField(m.employerStatus),
      escapeCsvField(m.postingTitle),
      escapeCsvField(m.createdAt),
    ].join(","),
  )

  return [header, ...rows].join("\n")
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
