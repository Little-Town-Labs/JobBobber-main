"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

/**
 * RoleSelectorForm — lets a new user choose Job Seeker or Employer.
 *
 * On success the server returns a redirectTo path; we push to it.
 * Employer selection reveals a required "Company name" field.
 *
 * @see src/server/api/routers/onboarding.ts — setRole mutation
 */
export function RoleSelectorForm() {
  const router = useRouter()
  const [role, setRole] = useState<"JOB_SEEKER" | "EMPLOYER" | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const setRoleMutation = trpc.onboarding.setRole.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)
    setMutationError(null)

    if (!role) {
      setValidationError("Please select a role.")
      return
    }

    if (role === "EMPLOYER" && !companyName.trim()) {
      setValidationError("Company name is required for employers.")
      return
    }

    try {
      const result = await setRoleMutation.mutateAsync(
        role === "EMPLOYER" ? { role, companyName: companyName.trim() } : { role },
      )
      router.push(result.redirectTo)
    } catch {
      setMutationError("Failed to create account. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset>
        <legend>I am a…</legend>

        <label>
          <input
            type="radio"
            name="role"
            value="JOB_SEEKER"
            checked={role === "JOB_SEEKER"}
            onChange={() => setRole("JOB_SEEKER")}
          />
          {" Job Seeker"}
        </label>

        <label>
          <input
            type="radio"
            name="role"
            value="EMPLOYER"
            checked={role === "EMPLOYER"}
            onChange={() => setRole("EMPLOYER")}
          />
          {" Employer"}
        </label>
      </fieldset>

      {role === "EMPLOYER" && (
        <div>
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company name"
          />
        </div>
      )}

      {validationError && <p role="alert">{validationError}</p>}

      {mutationError && <p role="alert">{mutationError}</p>}

      <button type="submit" disabled={setRoleMutation.isPending}>
        Continue
      </button>
    </form>
  )
}
