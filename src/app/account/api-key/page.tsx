import { ApiKeyManager } from "@/components/onboarding/api-key-manager"

/**
 * /account/api-key — Account settings: manage BYOK API key.
 *
 * Post-onboarding page where users can view, change, or delete
 * their stored API key.
 */
export default function AccountApiKeyPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">API Key Settings</h1>
      <p className="mb-6 text-gray-500">
        Manage the API key used by your AI matching agent. Changing your key will take effect
        immediately.
      </p>
      <ApiKeyManager />
    </main>
  )
}
