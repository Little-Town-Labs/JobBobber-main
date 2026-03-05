"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

interface SkillsFormProps {
  skills: string[]
}

const MAX_SKILLS = 50

export function SkillsForm({ skills: initialSkills }: SkillsFormProps) {
  const [skills, setSkills] = useState<string[]>(initialSkills)
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateProfile = trpc.jobSeekers.updateProfile.useMutation()

  const atLimit = skills.length >= MAX_SKILLS

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (!trimmed || atLimit) return
    if (skills.includes(trimmed)) return // no duplicates
    setSkills([...skills, trimmed])
    setInputValue("")
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addSkill(inputValue)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    try {
      await updateProfile.mutateAsync({ skills })
      setSuccess(true)
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        {skills.map((skill) => (
          <span key={skill}>
            {skill}
            <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a skill"
        disabled={atLimit}
      />

      {error && <p role="alert">{error}</p>}
      {atLimit && <p>Maximum 50 skills reached.</p>}
      {success && <p>Saved successfully.</p>}

      <button type="submit" disabled={updateProfile.isPending}>
        Save
      </button>
    </form>
  )
}
