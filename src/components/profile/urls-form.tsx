"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface UrlEntry {
  id: string
  label: string
  url: string
}

interface UrlsFormProps {
  urls: UrlEntry[]
}

const MAX_URLS = 10

function generateId(): string {
  return `clx${Math.random().toString(36).slice(2, 25).padEnd(22, "0")}`
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function validate(entries: UrlEntry[]): string | null {
  for (const entry of entries) {
    if (entry.url && !isValidUrl(entry.url)) {
      return `"${entry.url}" is not a valid URL. Use a full URL starting with https://.`
    }
  }
  return null
}

export function UrlsForm({ urls: initialUrls }: UrlsFormProps) {
  const [entries, setEntries] = useState<UrlEntry[]>(initialUrls)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  const atLimit = entries.length >= MAX_URLS

  function addEntry() {
    if (atLimit) return
    setEntries([...entries, { id: generateId(), label: "", url: "" }])
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, field: keyof UrlEntry, value: string) {
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
      await updateProfile.mutateAsync({ urls: entries })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {entries.map((entry, index) => (
        <div key={entry.id}>
          <div>
            <label htmlFor={`label-${entry.id}`}>Label</label>
            <input
              id={`label-${entry.id}`}
              type="text"
              value={entry.label}
              onChange={(e) => updateEntry(entry.id, "label", e.target.value)}
              placeholder={`e.g. GitHub ${index + 1}`}
            />
          </div>
          <div>
            <label htmlFor={`url-${entry.id}`}>URL</label>
            <input
              id={`url-${entry.id}`}
              type="url"
              value={entry.url}
              onChange={(e) => updateEntry(entry.id, "url", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <button type="button" onClick={() => removeEntry(entry.id)}>
            Remove
          </button>
        </div>
      ))}

      {error && <p role="alert">{error}</p>}
      {success && <p>Saved successfully.</p>}

      <button type="button" onClick={addEntry} disabled={atLimit}>
        Add URL
      </button>
      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
