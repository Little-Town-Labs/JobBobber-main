"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface CompanyProfileFormProps {
  employer: {
    name: string
    description: string | null
    industry: string | null
    size: string | null
    culture: string | null
    headquarters: string | null
    websiteUrl: string | null
  }
}

function validate(name: string, websiteUrl: string): string | null {
  if (!name.trim()) return "Company name is required."
  if (name.length > 255) return "Company name must be 255 characters or fewer."
  if (websiteUrl.trim() && !/^https?:\/\/.+\..+/.test(websiteUrl.trim())) {
    return "Website URL must be a valid URL (e.g. https://example.com)."
  }
  return null
}

export function CompanyProfileForm({ employer }: CompanyProfileFormProps) {
  const [name, setName] = useState(employer.name ?? "")
  const [description, setDescription] = useState(employer.description ?? "")
  const [industry, setIndustry] = useState(employer.industry ?? "")
  const [size, setSize] = useState(employer.size ?? "")
  const [culture, setCulture] = useState(employer.culture ?? "")
  const [headquarters, setHeadquarters] = useState(employer.headquarters ?? "")
  const [websiteUrl, setWebsiteUrl] = useState(employer.websiteUrl ?? "")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.employers.updateProfile.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate(name, websiteUrl)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await updateProfile.mutateAsync({
        name,
        description: description || undefined,
        industry: industry || undefined,
        size: size || undefined,
        culture: culture || undefined,
        headquarters: headquarters || undefined,
        websiteUrl: websiteUrl || undefined,
      })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="company-name">Company Name</label>
        <input
          id="company-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      <div>
        <label htmlFor="industry">Industry</label>
        <input
          id="industry"
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="size">Size</label>
        <input id="size" type="text" value={size} onChange={(e) => setSize(e.target.value)} />
      </div>

      <div>
        <label htmlFor="culture">Culture</label>
        <textarea
          id="culture"
          value={culture}
          onChange={(e) => setCulture(e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="headquarters">Headquarters</label>
        <input
          id="headquarters"
          type="text"
          value={headquarters}
          onChange={(e) => setHeadquarters(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="website-url">Website URL</label>
        <input
          id="website-url"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
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
