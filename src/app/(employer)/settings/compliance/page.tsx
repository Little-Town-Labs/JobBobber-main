"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { useComplianceGetMfaStatus, useComplianceGetDeletionStatus } from "@/lib/trpc/hooks"

export default function EmployerCompliancePage() {
  const [confirmText, setConfirmText] = useState("")

  const mfaStatus = useComplianceGetMfaStatus()
  const deletionStatus = useComplianceGetDeletionStatus()

  const exportMutation = trpc.compliance.exportMyData.useQuery(undefined, {
    enabled: false,
    retry: false,
  }) as unknown as { refetch: () => Promise<{ data: unknown }>; isFetching: boolean } // tRPC useQuery with enabled:false returns incompatible shape

  const requestDeletion = trpc.compliance.requestDeletion.useMutation()
  const cancelDeletion = trpc.compliance.cancelDeletion.useMutation()
  const dismissMfa = trpc.compliance.dismissMfaPrompt.useMutation()

  async function handleExport() {
    const result = await exportMutation.refetch()
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `jobbobber-data-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function handleRequestDeletion() {
    await requestDeletion.mutateAsync({ confirmation: confirmText })
    setConfirmText("")
  }

  async function handleCancelDeletion() {
    await cancelDeletion.mutateAsync()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Privacy &amp; Compliance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization&apos;s data, account deletion, and security settings.
        </p>
      </div>

      {/* Data Export Section */}
      <section data-testid="data-export-section" className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Data Export</h2>
        <p className="mt-1 text-sm text-gray-500">
          Download a copy of all your organization&apos;s data stored in JobBobber, including job
          postings, matches, and conversations.
        </p>
        <button
          onClick={handleExport}
          disabled={exportMutation.isFetching}
          data-testid="export-button"
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exportMutation.isFetching ? "Exporting..." : "Export Organization Data"}
        </button>
      </section>

      {/* Account Deletion Section */}
      <section
        data-testid="account-deletion-section"
        className="rounded-lg border border-red-200 p-6"
      >
        <h2 className="text-lg font-semibold text-red-700">Account Deletion</h2>

        {deletionStatus.data?.hasPendingDeletion ? (
          <div data-testid="deletion-pending" className="mt-3">
            <p className="text-sm text-red-600">
              Your organization&apos;s account is scheduled for deletion on{" "}
              <strong>
                {new Date(deletionStatus.data.request!.scheduledAt).toLocaleDateString()}
              </strong>
              .
            </p>
            <button
              onClick={handleCancelDeletion}
              disabled={cancelDeletion.isPending}
              data-testid="cancel-deletion-button"
              className="mt-3 rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {cancelDeletion.isPending ? "Cancelling..." : "Cancel Deletion"}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-gray-500">
              This will delete your organization&apos;s account, all job postings, and related data.
              This action is irreversible after 72 hours. Type <strong>DELETE MY ACCOUNT</strong> to
              confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE MY ACCOUNT"'
              data-testid="confirm-deletion-input"
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <button
              onClick={handleRequestDeletion}
              disabled={confirmText !== "DELETE MY ACCOUNT" || requestDeletion.isPending}
              data-testid="request-deletion-button"
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {requestDeletion.isPending ? "Requesting..." : "Request Deletion"}
            </button>
            {requestDeletion.isError && (
              <p className="mt-2 text-sm text-red-600">
                Failed to request deletion. Please try again.
              </p>
            )}
          </div>
        )}
      </section>

      {/* MFA Status Section */}
      <section data-testid="mfa-section" className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Multi-Factor Authentication</h2>
        {mfaStatus.isLoading ? (
          <div className="mt-2 h-6 w-32 animate-pulse rounded bg-gray-200" />
        ) : mfaStatus.data?.mfaEnabled ? (
          <p className="mt-2 text-sm text-green-600" data-testid="mfa-enabled">
            MFA is enabled for your organization.
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-yellow-600" data-testid="mfa-disabled">
              MFA is not enabled. We recommend enabling it for additional security.
            </p>
            <div className="mt-3 flex gap-3">
              <a
                href="/settings/security"
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                data-testid="mfa-setup-link"
              >
                Set up MFA
              </a>
              {mfaStatus.data?.shouldPrompt && (
                <button
                  onClick={() => dismissMfa.mutate()}
                  disabled={dismissMfa.isPending}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  data-testid="dismiss-mfa-button"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
