"use client"

import { useState } from "react"

type StoreKeyResult = {
  success: true
  provider: string
  maskedKey: string
}

interface ByokSetupFormProps {
  onSuccess: (result: StoreKeyResult) => void
}

/**
 * ByokSetupForm — lets the user add or replace their BYOK API key.
 *
 * Validates locally (empty key) then calls the tRPC HTTP endpoint for
 * byok.storeKey which validates format, verifies against the provider,
 * and stores the encrypted key.
 *
 * @see src/server/api/routers/byok.ts — storeKey mutation
 */
export function ByokSetupForm({ onSuccess }: ByokSetupFormProps) {
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai")
  const [apiKey, setApiKey] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)
    setMutationError(null)

    if (!apiKey.trim()) {
      setValidationError("API key is required.")
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/trpc/byok.storeKey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { provider, apiKey: apiKey.trim() } }),
      })
      const json = (await res.json()) as {
        result?: { data?: { json?: StoreKeyResult } }
        error?: unknown
      }
      if (!res.ok || json.error) {
        setMutationError("Failed to save API key. Please check the key and try again.")
        return
      }
      const result = json.result?.data?.json
      if (!result) {
        setMutationError("Unexpected response from server.")
        return
      }
      setApiKey("") // Clear plaintext key from state immediately after submission
      onSuccess(result)
    } catch {
      setMutationError("Failed to save API key. Please check the key and try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="provider">Provider</label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>

      <div>
        <label htmlFor="apiKey">API key</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
        />
      </div>

      {validationError && <p role="alert">{validationError}</p>}

      {mutationError && <p role="alert">{mutationError}</p>}

      <button type="submit" disabled={isPending}>
        Save API Key
      </button>
    </form>
  )
}
