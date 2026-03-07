"use client"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-red-100 text-red-700",
  FILLED: "bg-blue-100 text-blue-700",
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>
}
