"use client"

import { useState } from "react"
import Link from "next/link"

interface ExistingKey {
  id: string
  label: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
}

interface Props {
  existingKeys: ExistingKey[]
}

/**
 * ApiKeyGenerator — client component for the /welcome onboarding step.
 *
 * First visit (no keys): shows "Generate your API key" button.
 * On click: calls apiKeys.create and displays the raw key once.
 *
 * Revisit (keys present): shows key list only; no generate button.
 *
 * @see src/server/api/routers/apiKeys.ts
 */
export function ApiKeyGenerator({ existingKeys }: Props) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const hasKeys = existingKeys.length > 0

  async function handleGenerate() {
    setError(null)
    setIsPending(true)
    try {
      const res = await fetch("/api/trpc/apiKeys.create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { label: "Default" } }),
      })
      const json = (await res.json()) as {
        result?: {
          data?: {
            json?: { id: string; raw: string; label: string; prefix: string; createdAt: string }
          }
        }
        error?: unknown
      }
      if (!res.ok || json.error) {
        setError("Failed to generate API key. Please try again.")
        return
      }
      const raw = json.result?.data?.json?.raw
      if (!raw) {
        setError("Unexpected response from server.")
        return
      }
      setGeneratedKey(raw)
    } catch {
      setError("Failed to generate API key. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  async function handleCopy() {
    if (!generatedKey) return
    try {
      await navigator.clipboard.writeText(generatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the input text
    }
  }

  return (
    <div className="space-y-6">
      {hasKeys ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your API keys
          </h2>
          <ul
            data-testid="api-key-list"
            className="divide-y divide-gray-100 rounded-md border border-gray-200"
          >
            {existingKeys.map((key) => (
              <li key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{key.label}</p>
                  <p className="font-mono text-xs text-gray-500">{key.prefix}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : generatedKey ? (
        <div className="space-y-3">
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This key will not be shown again. Copy it now.
          </p>
          <div className="flex items-center gap-2">
            <input
              data-testid="masked-api-key"
              type="text"
              readOnly
              value={generatedKey}
              className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isPending ? "Generating…" : "Generate your API key"}
          </button>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Read the{" "}
        <Link href="/docs" className="font-medium text-blue-600 underline hover:text-blue-700">
          API documentation
        </Link>{" "}
        to get started.
      </p>
    </div>
  )
}
