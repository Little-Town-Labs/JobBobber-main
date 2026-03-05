"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

const TRANSITIONS: Record<string, { label: string; target: string }[]> = {
  DRAFT: [{ label: "Activate", target: "ACTIVE" }],
  ACTIVE: [
    { label: "Pause", target: "PAUSED" },
    { label: "Close", target: "CLOSED" },
    { label: "Mark Filled", target: "FILLED" },
  ],
  PAUSED: [
    { label: "Reactivate", target: "ACTIVE" },
    { label: "Close", target: "CLOSED" },
    { label: "Mark Filled", target: "FILLED" },
  ],
  CLOSED: [],
  FILLED: [],
}

interface StatusControlsProps {
  postingId: string
  status: string
  canActivate: boolean
  onStatusChange: () => void
}

export function StatusControls({
  postingId,
  status,
  canActivate,
  onStatusChange,
}: StatusControlsProps) {
  const updateStatus = trpc.jobPostings.updateStatus.useMutation()
  const [error, setError] = useState<string | null>(null)

  const transitions = TRANSITIONS[status] ?? []
  if (transitions.length === 0) return null

  async function handleTransition(target: string) {
    setError(null)
    try {
      await updateStatus.mutateAsync({
        id: postingId,
        status: target as "ACTIVE" | "PAUSED" | "CLOSED" | "FILLED",
      })
      onStatusChange()
    } catch {
      setError("Failed to update status. Please try again.")
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map(({ label, target }) => {
        const isActivation = target === "ACTIVE" && status === "DRAFT"
        const disabled = updateStatus.isPending || (isActivation && !canActivate)

        return (
          <button
            key={target}
            type="button"
            onClick={() => handleTransition(target)}
            disabled={disabled}
            className="rounded border px-3 py-1 text-sm"
          >
            {label}
          </button>
        )
      })}
      {status === "DRAFT" && !canActivate && (
        <p className="text-sm text-red-600">
          Title, description, and at least one required skill are needed to activate.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
