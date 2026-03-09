"use client"

import { trpc } from "@/lib/trpc/client"

interface PricingTableProps {
  userType: "JOB_SEEKER" | "EMPLOYER"
}

export function PricingTable({ userType }: PricingTableProps) {
  const { data: plans, isLoading: plansLoading } = trpc.billing.getPlans.useQuery({ userType })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subQuery = (trpc.billing.getSubscription as any).useQuery() as {
    data: { planId: string; status: string } | null | undefined
    isLoading: boolean
  }
  const { data: subscription, isLoading: subLoading } = subQuery

  const checkout = trpc.billing.createCheckoutSession.useMutation()

  if (plansLoading || subLoading) {
    return (
      <div data-testid="pricing-loading">
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  const currentPlanId =
    subscription?.planId ?? (userType === "JOB_SEEKER" ? "seeker_free" : "employer_free")

  const handleUpgrade = (planId: string) => {
    checkout.mutate(
      { planId },
      {
        onSuccess: (data) => {
          if (data?.checkoutUrl) {
            window.location.href = data.checkoutUrl
          }
        },
      },
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-3" data-testid="pricing-table">
      {(plans ?? []).map((plan) => {
        const isCurrent = plan.id === currentPlanId
        const isEnterprise = plan.isEnterprise
        const isFree = plan.monthlyPrice === 0 && !isEnterprise

        return (
          <div
            key={plan.id}
            className={`rounded-lg border p-6 ${isCurrent ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}`}
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {isCurrent && (
                <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mb-4">
              {isEnterprise ? (
                <span className="text-2xl font-bold">Custom</span>
              ) : (
                <>
                  <span className="text-2xl font-bold">${plan.monthlyPrice}</span>
                  {!isFree && <span className="text-sm text-gray-500">/mo</span>}
                </>
              )}
            </div>

            <ul className="mb-6 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start text-sm text-gray-600">
                  <span className="mr-2 text-green-500">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>

            {isEnterprise ? (
              <a
                href="mailto:sales@jobbobber.com"
                className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Contact Sales
              </a>
            ) : isCurrent ? (
              <button
                disabled
                className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
              >
                Current Plan
              </button>
            ) : !isFree ? (
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={checkout.isPending}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {checkout.isPending ? "Loading..." : "Upgrade"}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
