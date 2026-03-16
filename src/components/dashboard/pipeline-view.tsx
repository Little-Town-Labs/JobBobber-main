"use client"

import Link from "next/link"
import { useDashboardGetPipelineSummary } from "@/lib/trpc/hooks"

export function PipelineView() {
  const { data, isLoading } = useDashboardGetPipelineSummary()

  if (isLoading) {
    return (
      <div data-testid="pipeline-loading">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.postings.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-gray-500">No active postings</p>
        <p className="mt-2 text-sm text-gray-400">
          Start receiving candidate matches by creating your first job posting.
        </p>
        <Link
          href="/postings/new"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create a Posting
        </Link>
      </div>
    )
  }

  const { postings, totals } = data

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="pb-2 pr-4">Posting</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4 text-right">Total</th>
            <th className="pb-2 pr-4 text-right">Pending</th>
            <th className="pb-2 pr-4 text-right">Accepted</th>
            <th className="pb-2 pr-4 text-right">Declined</th>
            <th className="pb-2 text-right">Match Rate</th>
          </tr>
        </thead>
        <tbody>
          {postings.map((posting) => (
            <tr key={posting.id} className="border-b last:border-0">
              <td className="py-3 pr-4">
                <Link
                  href={`/postings/${posting.id}/matches`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {posting.title}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                  {posting.status}
                </span>
              </td>
              <td className="py-3 pr-4 text-right">{posting.matchCounts.total}</td>
              <td className="py-3 pr-4 text-right">{posting.matchCounts.pending}</td>
              <td className="py-3 pr-4 text-right">{posting.matchCounts.accepted}</td>
              <td className="py-3 pr-4 text-right">{posting.matchCounts.declined}</td>
              <td className="py-3 text-right font-medium">{posting.matchRate}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <td className="py-3 pr-4">Totals</td>
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4 text-right">{totals.totalMatches}</td>
            <td className="py-3 pr-4 text-right">{totals.totalPending}</td>
            <td className="py-3 pr-4 text-right">{totals.totalAccepted}</td>
            <td className="py-3 pr-4 text-right" />
            <td className="py-3 text-right" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
