"use client"

import { STATUS_LABELS } from "./conversation-constants"

interface ConversationSummary {
  id: string
  jobPostingTitle: string
  candidateName?: string
  status: string
  messageCount: number
  startedAt: string
  completedAt: string | null
  outcome: string | null
}

interface ConversationListProps {
  conversations: ConversationSummary[]
  role: "seeker" | "employer"
  onSelect: (conversationId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ConversationList({
  conversations,
  role,
  onSelect,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center" data-testid="empty-state">
        <p className="text-gray-500">No conversations yet.</p>
        <p className="mt-1 text-sm text-gray-400">
          {role === "employer"
            ? "Conversations will appear here once your agent evaluates candidates."
            : "Conversations will appear here when agents discuss opportunities on your behalf."}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-3">
        {conversations.map((conv) => {
          const status = STATUS_LABELS[conv.status] ?? {
            label: conv.status,
            className: "bg-gray-100 text-gray-700",
          }

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-gray-50"
              aria-label={`View conversation for ${conv.jobPostingTitle}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{conv.jobPostingTitle}</h3>
                  {role === "employer" && conv.candidateName && (
                    <p className="mt-0.5 text-sm text-gray-600">{conv.candidateName}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                  role="status"
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>{conv.messageCount} messages</span>
                <span aria-hidden="true">·</span>
                <span>Started {formatDate(conv.startedAt)}</span>
                {conv.outcome && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{conv.outcome}</span>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {hasMore && onLoadMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
