"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface ExperienceEntry {
  id: string
  jobTitle: string
  company: string
  startDate: string
  endDate: string | null
  description: string
}

interface ExperienceFormProps {
  experience: ExperienceEntry[]
}

function generateId(): string {
  return `clx${Math.random().toString(36).slice(2, 25).padEnd(22, "0")}`
}

function validate(entries: ExperienceEntry[]): string | null {
  for (const entry of entries) {
    if (entry.description.length > 2000) {
      return "Description must be 2000 characters or fewer."
    }
    if (entry.endDate && entry.endDate !== "present" && entry.startDate) {
      if (new Date(entry.endDate) < new Date(entry.startDate)) {
        return "End date cannot be before start date."
      }
    }
  }
  return null
}

export function ExperienceForm({ experience }: ExperienceFormProps) {
  const [entries, setEntries] = useState<ExperienceEntry[]>(experience)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  function addEntry() {
    setEntries([
      ...entries,
      {
        id: generateId(),
        jobTitle: "",
        company: "",
        startDate: "",
        endDate: null,
        description: "",
      },
    ])
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, field: keyof ExperienceEntry, value: string | null) {
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
      await updateProfile.mutateAsync({ experience: entries })
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
            <label htmlFor={`jobTitle-${entry.id}`}>Job Title</label>
            <input
              id={`jobTitle-${entry.id}`}
              type="text"
              value={entry.jobTitle}
              onChange={(e) => updateEntry(entry.id, "jobTitle", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`company-${entry.id}`}>Company</label>
            <input
              id={`company-${entry.id}`}
              type="text"
              value={entry.company}
              onChange={(e) => updateEntry(entry.id, "company", e.target.value)}
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
        Add experience
      </button>
      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
