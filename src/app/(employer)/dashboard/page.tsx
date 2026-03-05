"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { CompanyProfileCard } from "@/components/employer/company-profile-card"
import { JobPostingList } from "@/components/employer/job-posting-list"

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
      <h1 className="text-2xl font-bold">Employer Dashboard</h1>
      <CompanyProfileCard employer={employer} />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Job Postings</h2>
          <Link href="/postings/new" className="text-sm text-blue-600 hover:underline">
            New Posting
          </Link>
        </div>
        <JobPostingList postings={postingsData?.items ?? []} />
      </div>
    </div>
  )
}
