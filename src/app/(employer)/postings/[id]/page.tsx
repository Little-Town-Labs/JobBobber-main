"use client"

import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { StatusBadge } from "@/components/employer/status-badge"
import { StatusControls } from "@/components/employer/status-controls"
import { canActivate } from "@/lib/job-posting-status"

export default function ViewPostingPage() {
  const params = useParams<{ id: string }>()
  const { data: posting, isLoading, refetch } = trpc.jobPostings.getById.useQuery({ id: params.id })

  if (isLoading) {
    return (
      <div data-testid="posting-loading-skeleton">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-48 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (!posting) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{posting.title}</h1>
        <StatusBadge status={posting.status} />
        <a
          href={`/postings/${posting.id}/edit`}
          className="ml-auto text-sm text-blue-600 hover:underline"
        >
          Edit
        </a>
      </div>

      <StatusControls
        postingId={posting.id}
        status={posting.status}
        canActivate={canActivate(posting)}
        onStatusChange={() => refetch()}
      />

      <div className="space-y-4">
        {posting.department && (
          <p className="text-sm text-gray-600">Department: {posting.department}</p>
        )}
        <p>{posting.description}</p>
        {posting.responsibilities && (
          <div>
            <h3 className="font-medium">Responsibilities</h3>
            <p>{posting.responsibilities}</p>
          </div>
        )}
        <div className="flex gap-4 text-sm">
          <span>{posting.experienceLevel}</span>
          <span>{posting.employmentType}</span>
          <span>{posting.locationType}</span>
        </div>
        {(posting.salaryMin || posting.salaryMax) && (
          <p className="text-sm">
            Salary: {posting.salaryMin ? `$${posting.salaryMin.toLocaleString()}` : ""}
            {posting.salaryMin && posting.salaryMax ? " - " : ""}
            {posting.salaryMax ? `$${posting.salaryMax.toLocaleString()}` : ""}
          </p>
        )}
        {posting.requiredSkills.length > 0 && (
          <div>
            <h3 className="font-medium">Required Skills</h3>
            <div className="flex flex-wrap gap-1">
              {posting.requiredSkills.map((s) => (
                <span key={s} className="rounded bg-blue-100 px-2 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
