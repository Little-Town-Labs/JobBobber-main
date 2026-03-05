"use client"

import { useRouter } from "next/navigation"
import { ByokSetupForm } from "@/components/onboarding/api-key-form"

/**
 * /setup/api-key — Step 2: add a BYOK API key.
 *
 * Reached after role selection. On success the user is redirected to
 * their role-appropriate dashboard.
 *
 * The redirect target (/dashboard or /employer/dashboard) is not yet
 * implemented; we navigate to "/" for now and will update in Feature 3.
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
      <ByokSetupForm onSuccess={() => router.push("/")} />
    </div>
  )
}
