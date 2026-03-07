export interface ProfileCompletenessInput {
  name: string
  headline: string | null
  bio: string | null
  experience: unknown[]
  skills: string[]
  education: unknown[]
  location: string | null
  resumeUrl: string | null
}

const WEIGHTS = {
  name: 15,
  headline: 15,
  bio: 10,
  experience: 20,
  skills: 15,
  education: 10,
  resumeUrl: 10,
  location: 5,
} as const

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0
}

export function computeProfileCompleteness(seeker: ProfileCompletenessInput): number {
  let score = 0

  if (isNonEmpty(seeker.name)) score += WEIGHTS.name
  if (isNonEmpty(seeker.headline)) score += WEIGHTS.headline
  if (isNonEmpty(seeker.bio)) score += WEIGHTS.bio
  if (seeker.experience.length >= 1) score += WEIGHTS.experience
  if (seeker.skills.length >= 3) score += WEIGHTS.skills
  if (seeker.education.length >= 1) score += WEIGHTS.education
  if (isNonEmpty(seeker.resumeUrl)) score += WEIGHTS.resumeUrl
  if (isNonEmpty(seeker.location)) score += WEIGHTS.location

  return score
}
