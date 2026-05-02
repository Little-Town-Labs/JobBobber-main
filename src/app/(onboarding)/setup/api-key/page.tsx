"use client"

import { useRouter } from "next/navigation"
import { ByokSetupForm } from "@/components/onboarding/api-key-form"

/**
 * /setup/api-key — Step 2: add a BYOK API key.
 *
 * Reached after role selection. On success, the user is sent to /welcome
 * to generate their JobBobber API key (free tier by default).
 */
export default function ApiKeySetupPage() {
  const router = useRouter()

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Connect your AI provider</h1>
      <p className="mb-6 text-gray-500">
        JobBobber uses your own API key to power the AI matching agent. Your key is encrypted before
        storage and never shared.
      </p>
      <ByokSetupForm onSuccess={() => router.push("/welcome")} />
    </div>
  )
}
