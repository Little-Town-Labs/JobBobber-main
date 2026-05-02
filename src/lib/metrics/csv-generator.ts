interface PostingMetric {
  title: string
  status: string
  createdAt: Date
  firstMatchAt: Date | null
  firstMutualAcceptAt: Date | null
  timeToFirstMatchMs: number | null
  timeToMutualAcceptMs: number | null
  totalMatches: number
  totalAccepts: number
}

const HEADERS = [
  "Title",
  "Status",
  "Created",
  "First Match Date",
  "First Mutual Accept Date",
  "Time to First Match (hours)",
  "Time to Mutual Accept (hours)",
  "Total Matches",
  "Total Accepts",
]

/**
 * RFC 4180-compliant CSV escape.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 * Internal double quotes are doubled.
 */
function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDate(date: Date | null): string {
  if (!date) return ""
  return date.toISOString().split("T")[0]!
}

function msToHours(ms: number | null): string {
  if (ms === null) return ""
  return (ms / (60 * 60 * 1000)).toFixed(1)
}

/**
 * Generate an RFC 4180-compliant CSV string from posting metrics.
 * Time values are converted from milliseconds to hours.
 */
export function generateMetricsCsv(postings: PostingMetric[]): string {
  const rows = [HEADERS.join(",")]

  for (const p of postings) {
    const fields = [
      escapeField(p.title),
      escapeField(p.status),
      formatDate(p.createdAt),
      formatDate(p.firstMatchAt),
      formatDate(p.firstMutualAcceptAt),
      msToHours(p.timeToFirstMatchMs),
      msToHours(p.timeToMutualAcceptMs),
      String(p.totalMatches),
      String(p.totalAccepts),
    ]
    rows.push(fields.join(","))
  }

  return rows.join("\n") + "\n"
}
