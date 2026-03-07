"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { ByokSetupForm } from "./api-key-form"

/**
 * ApiKeyManager — displays current BYOK key status and allows
 * the user to add, change, or delete their API key.
 *
 * Used on the /account/api-key settings page (post-onboarding).
 *
 * @see src/server/api/routers/byok.ts — getKeyStatus, deleteKey
 */
export function ApiKeyManager() {
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const statusQuery = trpc.byok.getKeyStatus.useQuery()
  const deleteKeyMutation = trpc.byok.deleteKey.useMutation()

  if (statusQuery.isLoading) {
    return <p>Loading…</p>
  }

  if (statusQuery.isError) {
    return <p role="alert">Failed to load API key status. Please refresh the page.</p>
  }

  const status = statusQuery.data

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteKeyMutation.mutateAsync()
      await statusQuery.refetch()
    } catch {
      setDeleteError("Failed to delete API key. Please try again.")
    }
  }

  function handleSaveSuccess() {
    setShowChangeForm(false)
    void statusQuery.refetch()
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

      <button type="button" onClick={handleDelete} disabled={deleteKeyMutation.isPending}>
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
