"use client"

interface SectionWeight {
  key: string
  label: string
  tab: string
  points: number
}

const SECTIONS: SectionWeight[] = [
  { key: "name", label: "Name", tab: "basic", points: 15 },
  { key: "headline", label: "Headline", tab: "basic", points: 15 },
  { key: "bio", label: "Bio", tab: "basic", points: 10 },
  { key: "experience", label: "Experience", tab: "experience", points: 20 },
  { key: "skills", label: "Skills", tab: "skills", points: 15 },
  { key: "education", label: "Education", tab: "education", points: 10 },
  { key: "resumeUrl", label: "Resume", tab: "basic", points: 10 },
  { key: "location", label: "Location", tab: "location", points: 5 },
]

interface ProfileForCompleteness {
  name: string
  headline: string | null
  bio: string | null
  resumeUrl: string | null
  experience: unknown[]
  education: unknown[]
  skills: string[]
  location: string | null
  profileCompleteness: number
}

interface CompletenessCardProps {
  profile: ProfileForCompleteness
}

function isSectionComplete(key: string, profile: ProfileForCompleteness): boolean {
  switch (key) {
    case "name":
      return Boolean(profile.name?.trim())
    case "headline":
      return Boolean(profile.headline?.trim())
    case "bio":
      return Boolean(profile.bio?.trim())
    case "experience":
      return profile.experience.length > 0
    case "skills":
      return profile.skills.length >= 3
    case "education":
      return profile.education.length > 0
    case "resumeUrl":
      return Boolean(profile.resumeUrl)
    case "location":
      return Boolean(profile.location?.trim())
    default:
      return false
  }
}

export function CompletenessCard({ profile }: CompletenessCardProps) {
  const score = profile.profileCompleteness
  const pointsNeeded = Math.max(0, 70 - score)
  const isActivationAvailable = score >= 70

  const incompleteSections = SECTIONS.filter((s) => !isSectionComplete(s.key, profile))

  return (
    <div>
      <h2>Profile Completeness</h2>
      <p>{score}%</p>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completeness"
        style={{ width: `${score}%` }}
      />
      {isActivationAvailable ? (
        <p>Agent activation available</p>
      ) : (
        <p>{pointsNeeded} more points needed to activate agent</p>
      )}
      {incompleteSections.length > 0 && (
        <ul>
          {incompleteSections.map((s) => (
            <li key={s.key}>
              <a href={`?tab=${s.tab}`}>{s.label}</a>
              {" — "}
              {s.points} pts
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
