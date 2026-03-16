"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { useSettingsGetSeekerSettings } from "@/lib/trpc/hooks"

export default function SeekerPrivateSettingsPage() {
  const utils = trpc.useUtils()

  const settingsQuery = useSettingsGetSeekerSettings()
  const { data: settings, isLoading } = settingsQuery
  const error = settingsQuery.error as { message: string; data?: { code?: string } } | null

  const updateSettings = trpc.settings.updateSeekerSettings.useMutation({
    onSuccess: () => {
      utils.settings.getSeekerSettings.invalidate()
    },
  })

  const [minSalary, setMinSalary] = useState<string>("")
  const [salaryRulesText, setSalaryRulesText] = useState<string>("")
  const [dealBreakers, setDealBreakers] = useState<string>("")
  const [priorities, setPriorities] = useState<string>("")
  const [exclusions, setExclusions] = useState<string>("")
  const [customPrompt, setCustomPrompt] = useState<string>("")
  const [initialized, setInitialized] = useState(false)

  // Populate form once data loads (React 18+ batches these setState calls)
  // Narrow to plain object to avoid TS2589 on deep RouterOutputs type
  const settingsData = settings as Record<string, unknown> | undefined
  if (settingsData && !initialized) {
    setMinSalary((settingsData.minSalary as number | null)?.toString() ?? "")
    setSalaryRulesText(
      typeof settingsData.salaryRules === "object" && settingsData.salaryRules
        ? ((settingsData.salaryRules as Record<string, unknown>).type?.toString() ?? "")
        : "",
    )
    setDealBreakers(((settingsData.dealBreakers as string[]) ?? []).join("\n"))
    setPriorities(((settingsData.priorities as string[]) ?? []).join("\n"))
    setExclusions(((settingsData.exclusions as string[]) ?? []).join("\n"))
    setCustomPrompt((settingsData.customPrompt as string) ?? "")
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
      minSalary: minSalary ? parseInt(minSalary, 10) : undefined,
      salaryRules: salaryRulesText ? { type: salaryRulesText } : undefined,
      dealBreakers: parseList(dealBreakers),
      priorities: parseList(priorities),
      exclusions: parseList(exclusions),
      customPrompt: customPrompt || undefined,
    })
  }

  if (isLoading) {
    return (
      <div data-testid="private-settings-loading">
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
        <h1 className="text-2xl font-bold">Private Negotiation Settings</h1>
        <p className="mt-1 text-sm text-gray-500" data-testid="privacy-notice">
          These settings are never shared with employers. They are used only by your AI agent during
          matching and negotiations.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
        data-testid="seeker-private-settings-form"
      >
        <div>
          <label htmlFor="minSalary" className="block text-sm font-medium text-gray-700">
            Minimum Salary
          </label>
          <input
            id="minSalary"
            type="number"
            min={0}
            value={minSalary}
            onChange={(e) => setMinSalary(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="e.g. 120000"
          />
        </div>

        <div>
          <label htmlFor="salaryRules" className="block text-sm font-medium text-gray-700">
            Salary Flexibility
          </label>
          <select
            id="salaryRules"
            value={salaryRulesText}
            onChange={(e) => setSalaryRulesText(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">No preference</option>
            <option value="firm">Firm minimum</option>
            <option value="flexible_for_equity">Flexible for equity</option>
            <option value="flexible_for_remote">Flexible for remote work</option>
            <option value="negotiable">Fully negotiable</option>
          </select>
        </div>

        <div>
          <label htmlFor="dealBreakers" className="block text-sm font-medium text-gray-700">
            Deal-Breakers (one per line, max 20)
          </label>
          <textarea
            id="dealBreakers"
            value={dealBreakers}
            onChange={(e) => setDealBreakers(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="No relocation required&#10;Must allow remote work"
          />
        </div>

        <div>
          <label htmlFor="priorities" className="block text-sm font-medium text-gray-700">
            Priorities (one per line, ordered by importance, max 20)
          </label>
          <textarea
            id="priorities"
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Work-life balance&#10;Compensation&#10;Growth opportunities"
          />
        </div>

        <div>
          <label htmlFor="exclusions" className="block text-sm font-medium text-gray-700">
            Exclusions — companies or industries to avoid (one per line, max 20)
          </label>
          <textarea
            id="exclusions"
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Defense industry&#10;Company X"
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
            placeholder="Be assertive on salary but flexible on start date..."
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

      <DataUsageOptOut />
    </div>
  )
}

function DataUsageOptOut() {
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.settings.getSeekerDataUsageOptOut.useQuery()

  const toggle = trpc.settings.updateSeekerDataUsageOptOut.useMutation({
    onSuccess: () => {
      utils.settings.getSeekerDataUsageOptOut.invalidate()
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
