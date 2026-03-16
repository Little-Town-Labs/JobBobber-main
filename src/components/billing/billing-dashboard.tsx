"use client"

import { trpc } from "@/lib/trpc/client"
import {
  useBillingGetSubscription,
  useBillingGetUsage,
  useBillingGetPaymentHistory,
} from "@/lib/trpc/hooks"

interface BillingDashboardProps {
  userType: "JOB_SEEKER" | "EMPLOYER"
}

export function BillingDashboard({ userType }: BillingDashboardProps) {
  const { data: subscription, isLoading: subLoading } = useBillingGetSubscription()
  const { data: usage, isLoading: usageLoading } = useBillingGetUsage()
  const { data: payments, isLoading: historyLoading } = useBillingGetPaymentHistory()

  const checkout = trpc.billing.createCheckoutSession.useMutation()
  const portal = trpc.billing.createPortalSession.useMutation()

  const isLoading = subLoading || usageLoading || historyLoading

  if (isLoading) {
    return (
      <div data-testid="billing-loading">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  const planName = subscription?.planName ?? "Free"
  const monthlyPrice = subscription?.monthlyPrice ?? 0
  const hasSubscription = subscription !== null && subscription !== undefined
  const upgradePlanId = userType === "JOB_SEEKER" ? "seeker_pro" : "employer_business"

  const handleUpgrade = () => {
    checkout.mutate(
      { planId: upgradePlanId },
      {
        onSuccess: (data) => {
          if (data?.checkoutUrl) {
            window.location.href = data.checkoutUrl
          }
        },
      },
    )
  }

  const handleManagePayment = () => {
    portal.mutate(undefined, {
      onSuccess: (data) => {
        if (data?.portalUrl) {
          window.location.href = data.portalUrl
        }
      },
    })
  }

  const formatUsage = (current: number, limit: number | null) => {
    if (limit === null) return `${current} — Unlimited`
    return `${current} / ${limit}`
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{planName}</p>
            {monthlyPrice > 0 ? (
              <p className="text-sm text-gray-500">${monthlyPrice}/mo</p>
            ) : (
              <p className="text-sm text-gray-500">$0/mo</p>
            )}
            {subscription?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-gray-400">
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {hasSubscription ? (
              <button
                onClick={handleManagePayment}
                disabled={portal.isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {portal.isPending ? "Loading..." : "Manage Payment"}
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkout.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {checkout.isPending ? "Loading..." : "Upgrade"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Usage */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Usage This Month</h2>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-600">Conversations</span>
              <span className="font-medium">
                {usage ? formatUsage(usage.conversationsThisMonth, usage.conversationLimit) : "—"}
              </span>
            </div>
            {usage?.conversationLimit !== null && usage?.conversationLimit !== undefined && (
              <div className="h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{
                    width: `${Math.min(100, ((usage?.conversationsThisMonth ?? 0) / usage.conversationLimit) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>

          {userType === "EMPLOYER" && (
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-600">Active Postings</span>
                <span className="font-medium">
                  {usage ? formatUsage(usage.activePostings, usage.postingLimit) : "—"}
                </span>
              </div>
              {usage?.postingLimit !== null && usage?.postingLimit !== undefined && (
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{
                      width: `${Math.min(100, ((usage?.activePostings ?? 0) / usage.postingLimit) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Payment History */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Payment History</h2>
        {!payments || payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payment history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">{new Date(payment.date).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">${payment.amount.toFixed(2)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          payment.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {payment.status === "paid" ? "Paid" : payment.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {payment.invoiceUrl && (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
