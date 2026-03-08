"use client"

import { useMemo } from "react"
import { STATUS_LABELS } from "./conversation-constants"

interface RedactedMessage {
  role: "employer_agent" | "seeker_agent"
  content: string
  phase: string
  timestamp: string
  turnNumber: number
}

interface ConversationDetailProps {
  id: string
  jobPostingTitle: string
  candidateName?: string | null
  status: string
  startedAt: string
  completedAt: string | null
  outcome: string | null
  messages: RedactedMessage[]
  onBack: () => void
}

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  screening: "Screening",
  deep_evaluation: "Deep Evaluation",
  negotiation: "Negotiation",
  decision: "Decision",
}

const ROLE_LABELS: Record<string, string> = {
  employer_agent: "Employer Agent",
  seeker_agent: "Seeker Agent",
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function ConversationDetail({
  jobPostingTitle,
  candidateName,
  status,
  startedAt,
  completedAt,
  outcome,
  messages,
  onBack,
}: ConversationDetailProps) {
  const statusInfo = STATUS_LABELS[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700",
  }

  const phaseBreaks = useMemo(() => {
    const breaks = new Set<number>()
    let prevPhase = ""
    messages.forEach((msg, idx) => {
      if (msg.phase !== prevPhase) {
        breaks.add(idx)
        prevPhase = msg.phase
      }
    })
    return breaks
  }, [messages])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Back to conversation list"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{jobPostingTitle}</h2>
          {candidateName && <p className="text-sm text-gray-600">Candidate: {candidateName}</p>}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
          role="status"
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Started {formatTimestamp(startedAt)}</span>
        {completedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Completed {formatTimestamp(completedAt)}</span>
          </>
        )}
        {outcome && (
          <>
            <span aria-hidden="true">·</span>
            <span>{outcome}</span>
          </>
        )}
      </div>

      {status === "IN_PROGRESS" && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700" role="alert">
          This conversation is still in progress.
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3" role="log" aria-label="Conversation messages">
        {messages.length === 0 && (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-gray-500">No messages in this conversation yet.</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const showPhaseHeader = phaseBreaks.has(idx)
          const isEmployer = msg.role === "employer_agent"
          const roleLabel = ROLE_LABELS[msg.role] ?? msg.role

          return (
            <div key={idx}>
              {showPhaseHeader && (
                <div className="my-4 flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {PHASE_LABELS[msg.phase] ?? msg.phase}
                  </span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              )}

              <div
                className={`rounded-lg border p-3 ${
                  isEmployer ? "ml-0 mr-8 bg-white" : "ml-8 mr-0 bg-gray-50"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium" aria-label={`Message from ${roleLabel}`}>
                    {roleLabel}
                  </span>
                  <time dateTime={msg.timestamp}>{formatTimestamp(msg.timestamp)}</time>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{msg.content}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
