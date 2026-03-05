"use client"

import { trpc } from "@/lib/trpc/client"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { CompletenessCard } from "@/components/profile/completeness-card"

/**
 * /profile/setup — Job seeker profile editor.
 *
 * Fetches the authenticated seeker's profile via tRPC and renders:
 *   - ProfileTabs: tabbed form sections (Basic Info, Experience, etc.)
 *   - CompletenessCard: profile completeness score and missing-section guide
 *
 * Tab state is managed via ?tab search param (see ProfileTabs).
 * Loading state shows a skeleton before data arrives.
 */
export default function ProfileSetupPage() {
  const { data: profile, isLoading } = trpc.jobSeekers.getMe.useQuery()

  if (isLoading) {
    return (
      <div data-testid="profile-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <ProfileTabs profile={profile} />
      </div>
      <aside className="w-72">
        <CompletenessCard profile={profile} />
      </aside>
    </div>
  )
}
