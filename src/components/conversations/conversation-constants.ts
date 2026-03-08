export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
  COMPLETED_MATCH: { label: "Matched", className: "bg-green-100 text-green-800" },
  COMPLETED_NO_MATCH: { label: "No Match", className: "bg-gray-100 text-gray-700" },
  TERMINATED: { label: "Terminated", className: "bg-red-100 text-red-800" },
}
