"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface EducationEntry {
  id: string
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string | null
  description: string
}

interface EducationFormProps {
  education: EducationEntry[]
}

function generateId(): string {
  return `clx${Math.random().toString(36).slice(2, 25).padEnd(22, "0")}`
}

function validate(entries: EducationEntry[]): string | null {
  for (const entry of entries) {
    if (entry.description.length > 1000) {
      return "Description must be 1000 characters or fewer."
    }
  }
  return null
}

export function EducationForm({ education }: EducationFormProps) {
  const [entries, setEntries] = useState<EducationEntry[]>(education)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  function addEntry() {
    setEntries([
      ...entries,
      {
        id: generateId(),
        institution: "",
        degree: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: null,
        description: "",
      },
    ])
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, field: keyof EducationEntry, value: string | null) {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate(entries)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await updateProfile.mutateAsync({ education: entries })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {entries.map((entry) => (
        <div key={entry.id}>
          <div>
            <label htmlFor={`institution-${entry.id}`}>Institution</label>
            <input
              id={`institution-${entry.id}`}
              type="text"
              value={entry.institution}
              onChange={(e) => updateEntry(entry.id, "institution", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`degree-${entry.id}`}>Degree</label>
            <input
              id={`degree-${entry.id}`}
              type="text"
              value={entry.degree}
              onChange={(e) => updateEntry(entry.id, "degree", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`fieldOfStudy-${entry.id}`}>Field of Study</label>
            <input
              id={`fieldOfStudy-${entry.id}`}
              type="text"
              value={entry.fieldOfStudy}
              onChange={(e) => updateEntry(entry.id, "fieldOfStudy", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`startDate-${entry.id}`}>Start Date</label>
            <input
              id={`startDate-${entry.id}`}
              type="date"
              value={entry.startDate}
              onChange={(e) => updateEntry(entry.id, "startDate", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`endDate-${entry.id}`}>End Date</label>
            <input
              id={`endDate-${entry.id}`}
              type="date"
              value={entry.endDate ?? ""}
              onChange={(e) => updateEntry(entry.id, "endDate", e.target.value || null)}
            />
          </div>
          <div>
            <label htmlFor={`desc-${entry.id}`}>Description</label>
            <textarea
              id={`desc-${entry.id}`}
              value={entry.description}
              onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
              rows={3}
            />
          </div>
          <button type="button" onClick={() => removeEntry(entry.id)}>
            Remove
          </button>
        </div>
      ))}

      {error && <p role="alert">{error}</p>}
      {success && <p>Saved successfully.</p>}

      <button type="button" onClick={addEntry}>
        Add education
      </button>
      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
