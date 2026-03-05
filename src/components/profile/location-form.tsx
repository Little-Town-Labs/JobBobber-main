"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

type RelocationPreference = "NOT_OPEN" | "DOMESTIC" | "INTERNATIONAL" | "REMOTE_ONLY"

interface LocationFormProps {
  location: string | null
  relocationPreference: RelocationPreference | null
}

const RELOCATION_OPTIONS: { value: RelocationPreference; label: string }[] = [
  { value: "NOT_OPEN", label: "Not open to relocation" },
  { value: "DOMESTIC", label: "Open to domestic relocation" },
  { value: "INTERNATIONAL", label: "Open to international relocation" },
  { value: "REMOTE_ONLY", label: "Fully remote only" },
]

function validate(location: string): string | null {
  if (location.length > 255) return "Location must be 255 characters or fewer."
  return null
}

export function LocationForm({
  location: initialLocation,
  relocationPreference: initialRelocation,
}: LocationFormProps) {
  const [location, setLocation] = useState(initialLocation ?? "")
  const [relocationPreference, setRelocationPreference] = useState<RelocationPreference>(
    initialRelocation ?? "NOT_OPEN",
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate(location)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await updateProfile.mutateAsync({ location, relocationPreference })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Austin, TX"
        />
      </div>

      <div>
        <label htmlFor="relocationPreference">Relocation preference</label>
        {/* Note: label text must be distinct from "Location" to avoid getByLabelText ambiguity */}
        <select
          id="relocationPreference"
          value={relocationPreference}
          onChange={(e) => setRelocationPreference(e.target.value as RelocationPreference)}
        >
          {RELOCATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert">{error}</p>}
      {success && <p>Saved successfully.</p>}

      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
