"use client"

const CONFIDENCE_COLORS: Record<string, string> = {
  STRONG: "bg-green-100 text-green-700",
  GOOD: "bg-blue-100 text-blue-700",
  POTENTIAL: "bg-yellow-100 text-yellow-700",
}

interface ConfidenceBadgeProps {
  score: string
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const color = CONFIDENCE_COLORS[score] ?? "bg-gray-100 text-gray-700"

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{score}</span>
}
