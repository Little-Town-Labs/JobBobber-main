/** Valid status transitions for job postings. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED", "FILLED"],
  PAUSED: ["ACTIVE", "CLOSED", "FILLED"],
  CLOSED: [],
  FILLED: [],
}

/** Check if a status transition is allowed. */
export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/** Check if a posting has the minimum required fields to be activated. */
export function canActivate(posting: {
  title: string
  description: string
  requiredSkills: string[]
}): boolean {
  return (
    posting.title.length > 0 && posting.description.length > 0 && posting.requiredSkills.length >= 1
  )
}
