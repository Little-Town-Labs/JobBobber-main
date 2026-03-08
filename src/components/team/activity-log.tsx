"use client"

import { trpc } from "@/lib/trpc/client"

export function ActivityLog() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activityQuery = (trpc.team.getActivityLog as any).useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage: { nextCursor: string | null }) => lastPage.nextCursor,
    },
  )
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = activityQuery

  if (isLoading) {
    return (
      <div data-testid="activity-log-loading">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mb-3 h-12 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    )
  }

  const allItems = data?.pages?.flatMap((page: { items: ActivityEntry[] }) => page.items) ?? []

  if (allItems.length === 0) {
    return (
      <p data-testid="activity-log-empty" className="text-sm text-gray-500">
        No activity yet.
      </p>
    )
  }

  return (
    <div data-testid="activity-log">
      <ul className="divide-y">
        {allItems.map((entry: ActivityEntry) => (
          <li key={entry.id} className="py-3 text-sm">
            <span className="font-medium">{entry.actorName}</span>{" "}
            <span className="text-gray-600">{formatAction(entry.action)}</span>
            {entry.targetLabel && (
              <span className="text-gray-800"> &mdash; {entry.targetLabel}</span>
            )}
            <div className="mt-0.5 text-xs text-gray-400">
              {new Date(entry.createdAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50"
          data-testid="activity-log-load-more"
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  )
}

interface ActivityEntry {
  id: string
  actorName: string
  action: string
  targetType: string | null
  targetLabel: string | null
  createdAt: string
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    "member.invited": "invited a member",
    "member.role_changed": "changed a member's role",
    "member.removed": "removed a member",
    "invitation.revoked": "revoked an invitation",
    "posting.created": "created a posting",
    "posting.updated": "updated a posting",
    "posting.status_changed": "changed posting status",
    "posting.deleted": "deleted a posting",
  }
  return labels[action] ?? action
}
