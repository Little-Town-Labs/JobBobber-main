"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { CompanyProfileCard } from "@/components/employer/company-profile-card"
import { JobPostingList } from "@/components/employer/job-posting-list"
import { InsightsPanel } from "@/components/insights/insights-panel"
import { PipelineView } from "@/components/dashboard/pipeline-view"

export default function EmployerDashboardPage() {
  const { data: employer, isLoading: loadingEmployer } = trpc.employers.getMe.useQuery()
  const { data: postingsData, isLoading: loadingPostings } = trpc.jobPostings.listMine.useQuery()

  if (loadingEmployer || loadingPostings) {
    return (
      <div data-testid="employer-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-40 w-full animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (!employer) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employer Dashboard</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard/conversations" className="text-blue-600 hover:underline">
            Conversations
          </Link>
          <Link href="/dashboard/team" className="text-blue-600 hover:underline">
            Team
          </Link>
        </nav>
      </div>
      <CompanyProfileCard employer={employer} />
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Pipeline Overview</h2>
        <PipelineView />
      </section>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Job Postings</h2>
          <Link href="/postings/new" className="text-sm text-blue-600 hover:underline">
            New Posting
          </Link>
        </div>
        <JobPostingList postings={postingsData?.items ?? []} />
      </div>
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Feedback Insights</h2>
        <InsightsPanel variant="employer" />
      </section>
    </div>
  )
}
