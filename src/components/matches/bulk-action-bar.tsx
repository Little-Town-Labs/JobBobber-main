"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { generateMatchCsv, downloadCsv } from "@/lib/csv-export"

interface BulkActionBarProps {
  selectedIds: string[]
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  isAllSelected: boolean
  jobPostingId: string
  onComplete: () => void
}

interface ResultSummary {
  updated: number
  skipped: number
  action: "accepted" | "declined"
}

export function BulkActionBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  jobPostingId,
  onComplete,
}: BulkActionBarProps) {
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null)
  const utils = trpc.useUtils()
  const bulkUpdate = trpc.matches.bulkUpdateStatus.useMutation()

  const hasSelection = selectedIds.length > 0

  async function handleBulkAction(status: "ACCEPTED" | "DECLINED") {
    const actionLabel = status === "ACCEPTED" ? "accept" : "decline"
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} ${selectedIds.length} candidates?`,
    )

    if (!confirmed) return

    const result = await bulkUpdate.mutateAsync({
      jobPostingId,
      matchIds: selectedIds,
      status,
    })

    setResultSummary({
      updated: result.updated,
      skipped: result.skipped,
      action: status === "ACCEPTED" ? "accepted" : "declined",
    })

    void utils.matches.listForPosting.invalidate()
    onComplete()
  }

  function handleExportCsv() {
    // TODO: Pass actual match data instead of IDs for full CSV export
    const csvData = generateMatchCsv([] as Parameters<typeof generateMatchCsv>[0])
    downloadCsv(csvData, `matches-export-${Date.now()}.csv`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-gray-50 px-4 py-3">
      <span className="text-sm font-medium text-gray-700">{selectedIds.length} selected</span>

      <div className="flex gap-2">
        {!isAllSelected && (
          <button
            onClick={onSelectAll}
            className="rounded px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
          >
            Select All ({totalCount})
          </button>
        )}
        {hasSelection && (
          <button
            onClick={onClearSelection}
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Clear Selection
          </button>
        )}
      </div>

      <div className="ml-auto flex gap-2">
        <button
          onClick={() => handleBulkAction("ACCEPTED")}
          disabled={!hasSelection}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Batch Accept
        </button>
        <button
          onClick={() => handleBulkAction("DECLINED")}
          disabled={!hasSelection}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Batch Decline
        </button>
        <button
          onClick={handleExportCsv}
          className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Export CSV
        </button>
      </div>

      {resultSummary && (
        <div className="w-full rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {resultSummary.updated} {resultSummary.action}, {resultSummary.skipped} skipped
        </div>
      )}
    </div>
  )
}
