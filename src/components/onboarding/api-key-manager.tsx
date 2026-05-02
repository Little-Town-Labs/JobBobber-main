"use client"

import { useState, useEffect, useCallback } from "react"
import { ByokSetupForm } from "./api-key-form"

type KeyStatus = {
  hasKey: boolean
  provider?: string
  maskedKey?: string
}

/**
 * ApiKeyManager — displays current BYOK key status and allows
 * the user to add, change, or delete their API key.
 *
 * Used on the /account/api-key settings page (post-onboarding).
 *
 * @see src/server/api/routers/byok.ts — getKeyStatus, deleteKey
 */
export function ApiKeyManager() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const res = await fetch("/api/trpc/byok.getKeyStatus", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
      const json = (await res.json()) as {
        result?: { data?: { json?: KeyStatus } }
        error?: unknown
      }
      if (!res.ok || json.error) {
        setIsError(true)
        return
      }
      setStatus(json.result?.data?.json ?? null)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  async function handleDelete() {
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const res = await fetch("/api/trpc/byok.deleteKey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: null }),
      })
      const json = (await res.json()) as { error?: unknown }
      if (!res.ok || json.error) {
        setDeleteError("Failed to delete API key. Please try again.")
        return
      }
      await fetchStatus()
    } catch {
      setDeleteError("Failed to delete API key. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  function handleSaveSuccess() {
    setShowChangeForm(false)
    void fetchStatus()
  }

  if (isLoading) {
    return <p>Loading…</p>
  }

  if (isError) {
    return <p role="alert">Failed to load API key status. Please refresh the page.</p>
  }

  // No key stored — show setup form directly
  if (!status?.hasKey) {
    return (
      <div>
        <p>No API key configured</p>
        <ByokSetupForm onSuccess={handleSaveSuccess} />
      </div>
    )
  }

  // Key stored — show status + actions
  return (
    <div>
      <p>
        Provider: <strong>{status.provider}</strong>
      </p>
      <p>{status.maskedKey}</p>

      <button type="button" onClick={handleDelete} disabled={isDeleting}>
        Delete key
      </button>

      {deleteError && <p role="alert">{deleteError}</p>}

      {!showChangeForm && (
        <button type="button" onClick={() => setShowChangeForm(true)}>
          Change key
        </button>
      )}

      {showChangeForm && <ByokSetupForm onSuccess={handleSaveSuccess} />}
    </div>
  )
}
