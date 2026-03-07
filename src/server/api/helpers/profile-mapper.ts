import "server-only"

/** Build FullJobSeekerProfile response from a Prisma row. Omits parsedResume and all private fields. */
export function toFullProfile(seeker: {
  id: string
  name: string
  headline: string | null
  bio: string | null
  resumeUrl: string | null
  experience: unknown[]
  education: unknown[]
  skills: string[]
  profileUrls: unknown[]
  location: string | null
  relocationPreference: string | null
  profileCompleteness: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: seeker.id,
    name: seeker.name,
    headline: seeker.headline,
    bio: seeker.bio,
    resumeUrl: seeker.resumeUrl,
    experience: seeker.experience,
    education: seeker.education,
    skills: seeker.skills,
    // profileUrls (DB column) exposed as `urls` to match FullJobSeekerProfile contract
    urls: seeker.profileUrls,
    location: seeker.location,
    relocationPreference: seeker.relocationPreference,
    profileCompleteness: seeker.profileCompleteness,
    isActive: seeker.isActive,
    createdAt: seeker.createdAt.toISOString(),
    updatedAt: seeker.updatedAt.toISOString(),
  }
}
