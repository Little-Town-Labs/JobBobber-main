const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/**
 * Format a duration in milliseconds to a human-readable string.
 * Returns null for null input.
 *
 * Minutes are only shown when the duration is less than one day — for
 * multi-day durations, hour-level precision is sufficient for dashboard KPIs.
 *
 * Examples: "< 1 hour", "2 hours 15 minutes", "3 days 4 hours", "1 day"
 */
export function formatDuration(ms: number | null): string | null {
  if (ms === null) return null

  if (ms < MS_PER_HOUR) return "< 1 hour"

  const days = Math.floor(ms / MS_PER_DAY)
  const remainingAfterDays = ms % MS_PER_DAY
  const hours = Math.floor(remainingAfterDays / MS_PER_HOUR)
  const minutes = Math.floor((remainingAfterDays % MS_PER_HOUR) / MS_PER_MINUTE)

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`)
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`)
  }
  if (minutes > 0 && days === 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`)
  }

  return parts.join(" ") || "< 1 hour"
}
