"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

const URGENCY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const

export default function JobPostingSettingsPage() {
  const params = useParams<{ id: string }>()
  const jobPostingId = params.id
  const utils = trpc.useUtils()

  const {
    data: settings,
    isLoading,
    error,
  } = trpc.settings.getJobSettings.useQuery({ jobPostingId }, { enabled: !!jobPostingId })

  const updateSettings = trpc.settings.updateJobSettings.useMutation({
    onSuccess: () => {
      utils.settings.getJobSettings.invalidate({ jobPostingId })
    },
  })

  const [trueMaxSalary, setTrueMaxSalary] = useState<string>("")
  const [urgency, setUrgency] = useState<string>("MEDIUM")
  const [willingToTrain, setWillingToTrain] = useState<string>("")
  const [priorityAttrs, setPriorityAttrs] = useState<string>("")
  const [customPrompt, setCustomPrompt] = useState<string>("")
  const [initialized, setInitialized] = useState(false)

  if (settings && !initialized) {
    setTrueMaxSalary(settings.trueMaxSalary?.toString() ?? "")
    setUrgency(settings.urgency ?? "MEDIUM")
    setWillingToTrain((settings.willingToTrain ?? []).join("\n"))
    setPriorityAttrs((settings.priorityAttrs ?? []).join("\n"))
    setCustomPrompt(settings.customPrompt ?? "")
    setInitialized(true)
  }

  if (error?.data?.code === "NOT_FOUND") {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-yellow-800">This feature is not yet available.</p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const parseList = (text: string) =>
      text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)

    updateSettings.mutate({
      jobPostingId,
      trueMaxSalary: trueMaxSalary ? parseInt(trueMaxSalary, 10) : undefined,
      urgency: urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      willingToTrain: parseList(willingToTrain),
      priorityAttrs: parseList(priorityAttrs),
      customPrompt: customPrompt || undefined,
    })
  }

  if (isLoading) {
    return (
      <div data-testid="job-settings-loading">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Private Hiring Settings</h1>
        <p className="mt-1 text-sm text-gray-500" data-testid="privacy-notice">
          These settings are never shared with candidates. They are used only by your AI agent
          during candidate evaluation and negotiations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" data-testid="job-settings-form">
        <div>
          <label htmlFor="trueMaxSalary" className="block text-sm font-medium text-gray-700">
            True Maximum Salary (your actual budget)
          </label>
          <input
            id="trueMaxSalary"
            type="number"
            min={0}
            value={trueMaxSalary}
            onChange={(e) => setTrueMaxSalary(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="e.g. 180000"
          />
          <p className="mt-1 text-xs text-gray-400">
            May differ from the public salary range on your posting
          </p>
        </div>

        <div>
          <label htmlFor="urgency" className="block text-sm font-medium text-gray-700">
            Hiring Urgency
          </label>
          <select
            id="urgency"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {URGENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="willingToTrain" className="block text-sm font-medium text-gray-700">
            Skills You&apos;re Willing to Train (one per line, max 20)
          </label>
          <textarea
            id="willingToTrain"
            value={willingToTrain}
            onChange={(e) => setWillingToTrain(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Kubernetes&#10;GraphQL&#10;AWS"
          />
          <p className="mt-1 text-xs text-gray-400">
            Your agent will be less strict about filtering candidates missing these skills
          </p>
        </div>

        <div>
          <label htmlFor="priorityAttrs" className="block text-sm font-medium text-gray-700">
            Priority Candidate Attributes (one per line, ordered by importance, max 10)
          </label>
          <textarea
            id="priorityAttrs"
            value={priorityAttrs}
            onChange={(e) => setPriorityAttrs(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Culture fit&#10;Technical depth&#10;Communication skills"
          />
        </div>

        <div>
          <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700">
            Custom Agent Prompt (optional, max 2000 chars)
          </label>
          <textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Prioritize culture fit over years of experience..."
          />
          <p className="mt-1 text-xs text-gray-400">{customPrompt.length}/2000</p>
        </div>

        <button
          type="submit"
          disabled={updateSettings.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </button>

        {updateSettings.isSuccess && (
          <p className="text-sm text-green-600">Settings saved successfully.</p>
        )}
        {updateSettings.isError && (
          <p className="text-sm text-red-600">Failed to save settings. Please try again.</p>
        )}
      </form>
    </div>
  )
}
