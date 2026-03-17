"use client"

import type { ProfileResult } from "@/server/agents/chat-tools"

interface ProfilePreviewCardProps {
  profile: ProfileResult | null
}

function completenessColor(pct: number): string {
  if (pct >= 80) return "bg-green-500"
  if (pct >= 50) return "bg-blue-500"
  return "bg-yellow-500"
}

export function ProfilePreviewCard({ profile }: ProfilePreviewCardProps) {
  if (!profile) {
    return (
      <div data-testid="profile-preview-card" className="py-3 text-sm text-gray-500">
        No profile data available
      </div>
    )
  }

  return (
    <div
      data-testid="profile-preview-card"
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900">{profile.name}</h3>
      {profile.headline && <p className="mt-0.5 text-xs text-gray-600">{profile.headline}</p>}
      {profile.location && <p className="mt-1 text-xs text-gray-500">{profile.location}</p>}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Completeness bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Profile completeness</span>
          <span>{profile.profileCompleteness}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${completenessColor(profile.profileCompleteness)}`}
            style={{ width: `${profile.profileCompleteness}%` }}
          />
        </div>
      </div>

      {/* Counts */}
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span>
          {profile.experienceCount} experience{profile.experienceCount !== 1 ? "s" : ""}
        </span>
        <span>
          {profile.educationCount} education{profile.educationCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
