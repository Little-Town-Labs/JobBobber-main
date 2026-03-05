"use client"

import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { JobPostingForm } from "@/components/employer/job-posting-form"

export default function EditPostingPage() {
  const params = useParams<{ id: string }>()
  const { data: posting, isLoading } = trpc.jobPostings.getById.useQuery({ id: params.id })

  if (isLoading) {
    return (
      <div data-testid="posting-loading-skeleton">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (!posting) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Job Posting</h1>
      <JobPostingForm posting={posting} />
    </div>
  )
}
