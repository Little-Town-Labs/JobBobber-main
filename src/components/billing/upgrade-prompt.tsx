"use client"

import { trpc } from "@/lib/trpc/client"

interface UpgradePromptProps {
  /** The type of limit that was hit */
  limitType: "conversation" | "posting"
  /** Current usage count */
  currentUsage: number
  /** Plan limit */
  limit: number
}

export function UpgradePrompt({ limitType, currentUsage, limit }: UpgradePromptProps) {
  const checkout = trpc.billing.createCheckoutSession.useMutation()

  const messages: Record<string, { title: string; description: string; planId: string }> = {
    conversation: {
      title: "Conversation limit reached",
      description: `You've used ${currentUsage} of ${limit} agent conversations this month. Upgrade to unlock unlimited conversations.`,
      planId: "seeker_pro",
    },
    posting: {
      title: "Posting limit reached",
      description: `You have ${currentUsage} of ${limit} active job postings. Upgrade to unlock unlimited postings.`,
      planId: "employer_business",
    },
  }

  const msg = messages[limitType]!

  const handleUpgrade = () => {
    checkout.mutate(
      { planId: msg.planId },
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
    <div
      className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
      data-testid="upgrade-prompt"
    >
      <h3 className="font-semibold text-yellow-800">{msg.title}</h3>
      <p className="mt-1 text-sm text-yellow-700">{msg.description}</p>
      <button
        onClick={handleUpgrade}
        disabled={checkout.isPending}
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {checkout.isPending ? "Loading..." : "Upgrade Now"}
      </button>
    </div>
  )
}
