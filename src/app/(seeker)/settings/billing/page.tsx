"use client"

import { BillingDashboard } from "@/components/billing/billing-dashboard"
import { PricingTable } from "@/components/billing/pricing-table"

export default function SeekerBillingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your subscription and view your usage.</p>
      </div>

      <BillingDashboard userType="JOB_SEEKER" />

      <div>
        <h2 className="mb-4 text-xl font-semibold">Available Plans</h2>
        <PricingTable userType="JOB_SEEKER" />
      </div>
    </div>
  )
}
