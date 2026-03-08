"use client"

import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc/client"
import { ConversationList } from "@/components/conversations/conversation-list"
import { ConversationDetail } from "@/components/conversations/conversation-detail"

type StatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | "TERMINATED"

interface ConversationItem {
  id: string
  jobPostingTitle: string
  status: string
  messageCount: number
  startedAt: string
  completedAt: string | null
  outcome: string | null
}

export default function SeekerConversationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [pages, setPages] = useState<ConversationItem[][]>([])

  const {
    data: listData,
    isLoading,
    error,
    isFetching,
  } = trpc.conversations.listForSeeker.useQuery({
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(cursor ? { cursor } : {}),
  })

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

  function handleFilterChange(value: StatusFilter) {
    setStatusFilter(value)
    setCursor(undefined)
    setPages([])
    setSelectedId(null)
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

  if (isLoading && !cursor) {
    return (
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Failed to load conversations.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200"
        >
          Retry
        </button>
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

      <ConversationList
        conversations={accumulated}
        role="seeker"
        onSelect={setSelectedId}
        hasMore={listData?.hasMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isFetching && !!cursor}
      />
    </div>
  )
}
