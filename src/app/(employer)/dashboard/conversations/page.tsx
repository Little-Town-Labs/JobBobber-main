"use client"

import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc/client"
import { ConversationList } from "@/components/conversations/conversation-list"
import { ConversationDetail } from "@/components/conversations/conversation-detail"

type StatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | "TERMINATED"

interface ConversationItem {
  id: string
  jobPostingTitle: string
  candidateName?: string
  status: string
  messageCount: number
  startedAt: string
  completedAt: string | null
  outcome: string | null
}

export default function EmployerConversationsPage() {
  const [selectedPostingId, setSelectedPostingId] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [pages, setPages] = useState<ConversationItem[][]>([])

  const { data: postings } = trpc.jobPostings.listMine.useQuery()

  const {
    data: listData,
    isLoading,
    error,
    isFetching,
  } = trpc.conversations.listForEmployer.useQuery(
    {
      jobPostingId: selectedPostingId,
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(cursor ? { cursor } : {}),
    },
    { enabled: !!selectedPostingId },
  )

  const accumulated = useMemo(() => {
    const allPages = [...pages]
    if (listData) {
      allPages.push(listData.items)
    }
    const seen = new Set<string>()
    const result: ConversationItem[] = []
    for (const page of allPages) {
      for (const item of page) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          result.push(item)
        }
      }
    }
    return result
  }, [pages, listData])

  function handlePostingChange(value: string) {
    setSelectedPostingId(value)
    setSelectedId(null)
    setCursor(undefined)
    setPages([])
  }

  function handleFilterChange(value: StatusFilter) {
    setStatusFilter(value)
    setCursor(undefined)
    setPages([])
  }

  function handleLoadMore() {
    if (listData?.nextCursor) {
      setPages((prev) => [...prev, listData.items])
      setCursor(listData.nextCursor)
    }
  }

  const { data: detailData, isLoading: detailLoading } = trpc.conversations.getById.useQuery(
    { conversationId: selectedId! },
    { enabled: !!selectedId },
  )

  if (selectedId && detailData) {
    return (
      <div className="space-y-6">
        <ConversationDetail {...detailData} onBack={() => setSelectedId(null)} />
      </div>
    )
  }

  if (selectedId && detailLoading) {
    return (
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Matched", value: "COMPLETED_MATCH" },
    { label: "No Match", value: "COMPLETED_NO_MATCH" },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conversation Logs</h1>

      {/* Posting selector */}
      <div>
        <label htmlFor="posting-select" className="block text-sm font-medium text-gray-700">
          Job Posting
        </label>
        <select
          id="posting-select"
          value={selectedPostingId}
          onChange={(e) => handlePostingChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a job posting...</option>
          {(postings?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {selectedPostingId && (
        <>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={statusFilter === tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading && !cursor ? (
            <div>
              <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700">Failed to load conversations.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          ) : (
            <ConversationList
              conversations={accumulated}
              role="employer"
              onSelect={setSelectedId}
              hasMore={listData?.hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && !!cursor}
            />
          )}
        </>
      )}

      {!selectedPostingId && (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-gray-500">Select a job posting to view conversation logs.</p>
        </div>
      )}

      <EmployerDataUsageOptOut />
    </div>
  )
}

function EmployerDataUsageOptOut() {
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.settings.getEmployerDataUsageOptOut.useQuery()

  const toggle = trpc.settings.updateEmployerDataUsageOptOut.useMutation({
    onSuccess: () => {
      utils.settings.getEmployerDataUsageOptOut.invalidate()
    },
  })

  if (isLoading) return null

  return (
    <div className="border-t pt-6">
      <h2 className="text-lg font-semibold">Data Usage</h2>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Opt out of model improvement</p>
          <p className="text-xs text-gray-500">
            When enabled, your conversation data will not be used for model training. This applies
            to future conversations only.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={data?.optOut ?? false}
          onClick={() => toggle.mutate({ optOut: !(data?.optOut ?? false) })}
          disabled={toggle.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            data?.optOut ? "bg-blue-600" : "bg-gray-200"
          } disabled:opacity-50`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              data?.optOut ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {toggle.isSuccess && <p className="mt-1 text-xs text-green-600">Preference updated.</p>}
    </div>
  )
}
