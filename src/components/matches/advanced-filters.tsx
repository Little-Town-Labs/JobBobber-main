"use client"

export interface FilterState {
  status?: string
  experienceLevel?: string[]
  locationType?: string[]
  confidenceLevel?: string[]
}

interface AdvancedFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const EXPERIENCE_LEVELS = ["ENTRY", "MID", "SENIOR", "EXECUTIVE"] as const
const LOCATION_TYPES = ["REMOTE", "HYBRID", "ONSITE"] as const
const CONFIDENCE_LEVELS = ["STRONG", "GOOD", "POTENTIAL"] as const
const STATUS_OPTIONS = ["PENDING", "ACCEPTED", "DECLINED"] as const

function countActiveFilters(filters: FilterState): number {
  let count = 0
  if (filters.status) count += 1
  count += filters.experienceLevel?.length ?? 0
  count += filters.locationType?.length ?? 0
  count += filters.confidenceLevel?.length ?? 0
  return count
}

function toggleArrayValue(arr: string[] | undefined, value: string): string[] {
  const current = arr ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

export function AdvancedFilters({ filters, onChange }: AdvancedFiltersProps) {
  const activeCount = countActiveFilters(filters)

  function handleStatusChange(value: string) {
    onChange({
      ...filters,
      status: value || undefined,
    })
  }

  function handleCheckboxChange(
    group: "experienceLevel" | "locationType" | "confidenceLevel",
    value: string,
  ) {
    onChange({
      ...filters,
      [group]: toggleArrayValue(filters[group], value),
    })
  }

  function handleClearFilters() {
    onChange({
      status: undefined,
      experienceLevel: [],
      locationType: [],
      confidenceLevel: [],
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          {activeCount > 0 && (
            <span
              data-testid="active-filter-count"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white"
            >
              {activeCount}
            </span>
          )}
        </div>
        <button onClick={handleClearFilters} className="text-sm text-gray-500 hover:text-gray-700">
          Clear Filters
        </button>
      </div>

      {/* Status dropdown */}
      <div>
        <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-gray-600">
          Status
        </label>
        <select
          id="status-filter"
          value={filters.status ?? ""}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full rounded border px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Experience Level checkboxes */}
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-gray-600">Experience Level</legend>
        <div className="flex flex-wrap gap-3">
          {EXPERIENCE_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={filters.experienceLevel?.includes(level) ?? false}
                onChange={() => handleCheckboxChange("experienceLevel", level)}
                className="rounded border-gray-300"
              />
              {level}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Location Type checkboxes */}
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-gray-600">Location Type</legend>
        <div className="flex flex-wrap gap-3">
          {LOCATION_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={filters.locationType?.includes(type) ?? false}
                onChange={() => handleCheckboxChange("locationType", type)}
                className="rounded border-gray-300"
              />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Confidence Level checkboxes */}
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-gray-600">Confidence Level</legend>
        <div className="flex flex-wrap gap-3">
          {CONFIDENCE_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={filters.confidenceLevel?.includes(level) ?? false}
                onChange={() => handleCheckboxChange("confidenceLevel", level)}
                className="rounded border-gray-300"
              />
              {level}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
