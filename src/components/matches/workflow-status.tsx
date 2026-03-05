"use client"

interface WorkflowStatusData {
  status: "NOT_STARTED" | "RUNNING" | "COMPLETED"
  totalCandidates: number
  evaluatedCount: number
  matchesCreated: number
  error: string | null
}

interface WorkflowStatusProps {
  workflowStatus: WorkflowStatusData
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-gray-100 text-gray-700" },
  RUNNING: { label: "Running", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700" },
}

export function WorkflowStatus({ workflowStatus }: WorkflowStatusProps) {
  const config = STATUS_CONFIG[workflowStatus.status] ?? STATUS_CONFIG.NOT_STARTED!

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Matching Workflow</h3>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-semibold">{workflowStatus.totalCandidates}</p>
          <p className="text-xs text-gray-500">Candidates</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{workflowStatus.evaluatedCount}</p>
          <p className="text-xs text-gray-500">Evaluated</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{workflowStatus.matchesCreated}</p>
          <p className="text-xs text-gray-500">Matches</p>
        </div>
      </div>

      {workflowStatus.status === "RUNNING" && (
        <div className="h-1.5 w-full rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-blue-600 transition-all"
            style={{
              width:
                workflowStatus.totalCandidates > 0
                  ? `${(workflowStatus.evaluatedCount / workflowStatus.totalCandidates) * 100}%`
                  : "0%",
            }}
          />
        </div>
      )}

      {workflowStatus.error && <p className="text-xs text-red-600">{workflowStatus.error}</p>}
    </div>
  )
}
