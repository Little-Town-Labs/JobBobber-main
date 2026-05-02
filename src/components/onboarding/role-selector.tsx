"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
  const [isPending, setIsPending] = useState(false)

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

    const input = role === "EMPLOYER" ? { role, companyName: companyName.trim() } : { role }

    setIsPending(true)
    try {
      const res = await fetch("/api/trpc/onboarding.setRole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: input }),
      })
      const json = (await res.json()) as {
        result?: { data?: { json?: { redirectTo: string } } }
        error?: unknown
      }
      if (!res.ok || json.error) {
        setMutationError("Failed to create account. Please try again.")
        return
      }
      const redirectTo = json.result?.data?.json?.redirectTo
      if (!redirectTo) {
        setMutationError("Unexpected response from server.")
        return
      }
      router.push(redirectTo)
    } catch {
      setMutationError("Failed to create account. Please try again.")
    } finally {
      setIsPending(false)
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

      <button type="submit" disabled={isPending}>
        Continue
      </button>
    </form>
  )
}
