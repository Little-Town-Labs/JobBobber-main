"use client"

import { useRouter, useSearchParams } from "next/navigation"

const TABS = [
  { id: "basic", label: "Basic Info" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "urls", label: "URLs" },
  { id: "location", label: "Location" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ProfileTabsProps {
  profile: {
    id: string
    name: string
    headline: string | null
    bio: string | null
    resumeUrl: string | null
    experience: unknown[]
    education: unknown[]
    skills: string[]
    urls: unknown[]
    location: string | null
    relocationPreference: string | null
    profileCompleteness: number
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
}

export function ProfileTabs({ profile }: ProfileTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get("tab") as TabId | null) ?? "basic"

  function handleTabClick(tabId: TabId) {
    router.replace(`?tab=${tabId}`)
  }

  return (
    <div>
      <div role="tablist" aria-label="Profile sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {/* Section forms are rendered here by parent once implemented in Tasks 4.3–4.14 */}
        <p>
          {activeTab === "basic" && "Basic Info"}
          {activeTab === "experience" && "Experience"}
          {activeTab === "education" && "Education"}
          {activeTab === "skills" && "Skills"}
          {activeTab === "urls" && "URLs"}
          {activeTab === "location" && "Location"}
        </p>
        {/* Profile data available for child forms */}
        <span data-profile-id={profile.id} style={{ display: "none" }} />
      </div>
    </div>
  )
}
