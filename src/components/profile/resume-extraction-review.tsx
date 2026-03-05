"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface ProposedExtraction {
  headline?: string
  experience?: unknown[]
  education?: unknown[]
  skills?: string[]
  bio?: string
  location?: string
}

interface ResumeExtractionReviewProps {
  extractionId: string
  proposed: ProposedExtraction | Record<string, unknown>
  onApplied: (updatedProfile: unknown) => void
  onClose: () => void
}

export function ResumeExtractionReview({
  extractionId,
  proposed,
  onApplied,
  onClose,
}: ResumeExtractionReviewProps) {
  const typedProposed = proposed as ProposedExtraction

  const [applyHeadline, setApplyHeadline] = useState(false)
  const [applyExperience, setApplyExperience] = useState(false)
  const [applyEducation, setApplyEducation] = useState(false)
  const [applySkills, setApplySkills] = useState(false)
  const [mergeSkills, setMergeSkills] = useState(true)

  const applyExtraction = trpc.resume.applyExtraction.useMutation()

  function handleApplyAll() {
    setApplyHeadline(true)
    setApplyExperience(true)
    setApplyEducation(true)
    setApplySkills(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await applyExtraction.mutateAsync({
        extractionId,
        applyHeadline,
        applyExperience,
        applyEducation,
        applySkills,
        mergeSkills,
      })
      onApplied(result)
    } catch {
      // Errors are surfaced by the parent
    }
  }

  return (
    <div role="region" aria-label="Resume extraction review">
      <h3>AI Extraction Results</h3>

      <form onSubmit={handleSubmit} noValidate>
        {typedProposed.headline && (
          <div>
            <label>
              <input
                type="checkbox"
                name="applyHeadline"
                checked={applyHeadline}
                onChange={(e) => setApplyHeadline(e.target.checked)}
                aria-label="Apply headline"
              />
              Headline
            </label>
            <p>{typedProposed.headline}</p>
          </div>
        )}

        {typedProposed.experience && typedProposed.experience.length > 0 && (
          <div>
            <label>
              <input
                type="checkbox"
                name="applyExperience"
                checked={applyExperience}
                onChange={(e) => setApplyExperience(e.target.checked)}
                aria-label="Apply experience"
              />
              Experience
            </label>
            <p>{typedProposed.experience.length} entry(ies) extracted</p>
          </div>
        )}

        {typedProposed.education && typedProposed.education.length > 0 && (
          <div>
            <label>
              <input
                type="checkbox"
                name="applyEducation"
                checked={applyEducation}
                onChange={(e) => setApplyEducation(e.target.checked)}
                aria-label="Apply education"
              />
              Education
            </label>
            <p>{typedProposed.education.length} entry(ies) extracted</p>
          </div>
        )}

        {typedProposed.skills && typedProposed.skills.length > 0 && (
          <div>
            <label>
              <input
                type="checkbox"
                name="applySkills"
                checked={applySkills}
                onChange={(e) => setApplySkills(e.target.checked)}
                aria-label="Apply skills"
              />
              Skills
            </label>
            <p>{typedProposed.skills.join(", ")}</p>
            <label>
              <input
                type="checkbox"
                name="mergeSkills"
                checked={mergeSkills}
                onChange={(e) => setMergeSkills(e.target.checked)}
                aria-label="Merge skills"
              />
              Merge skills (uncheck to replace)
            </label>
          </div>
        )}

        <div>
          <button type="button" onClick={handleApplyAll}>
            Apply All
          </button>
          <button type="submit" disabled={applyExtraction.isPending}>
            Apply selected
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
