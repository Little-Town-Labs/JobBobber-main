"use client"

import { trpc } from "@/lib/trpc/client"
import { useComplianceGetMfaStatus } from "@/lib/trpc/hooks"

/**
 * Dismissible banner prompting users to enable MFA.
 * Renders nothing if MFA is already enabled or prompt was dismissed.
 */
export function MfaPromptBanner() {
  const mfaStatus = useComplianceGetMfaStatus()

  const dismissMfa = trpc.compliance.dismissMfaPrompt.useMutation()

  if (mfaStatus.isLoading) return null
  if (!mfaStatus.data?.shouldPrompt || mfaStatus.data.mfaEnabled) return null

  return (
    <div
      data-testid="mfa-prompt-banner"
      className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-yellow-800">
          Your account does not have multi-factor authentication enabled.
        </span>
        <a
          href="/settings/security"
          data-testid="mfa-setup-link"
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
        >
          Set up MFA
        </a>
      </div>
      <button
        onClick={() => dismissMfa.mutate()}
        disabled={dismissMfa.isPending}
        data-testid="dismiss-mfa-button"
        className="ml-4 text-sm text-gray-500 hover:text-gray-700"
      >
        Dismiss
      </button>
    </div>
  )
}
