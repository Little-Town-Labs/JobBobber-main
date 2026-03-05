"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface BasicInfoFormProps {
  profile: {
    name: string
    headline: string | null
    bio: string | null
  }
}

function validate(name: string, headline: string, bio: string): string | null {
  if (!name.trim()) return "Name is required."
  if (headline.length > 255) return "Headline must be 255 characters or fewer."
  if (bio.length > 2000) return "Bio must be 2000 characters or fewer."
  return null
}

export function BasicInfoForm({ profile }: BasicInfoFormProps) {
  const [name, setName] = useState(profile.name ?? "")
  const [headline, setHeadline] = useState(profile.headline ?? "")
  const [bio, setBio] = useState(profile.bio ?? "")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate(name, headline, bio)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await updateProfile.mutateAsync({ name, headline, bio })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label htmlFor="headline">Headline</label>
        <input
          id="headline"
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
        />
      </div>

      <div>
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell employers about yourself"
          rows={4}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {success && <p>Saved successfully.</p>}

      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
