import { createCaller } from "@/server/api/root"
import { createTRPCContext } from "@/server/api/trpc"
import { ApiKeyGenerator } from "@/components/onboarding/api-key-generator"

/**
 * WelcomePage — final onboarding step.
 *
 * Fetches the user's existing API keys server-side so the client
 * component can branch without an extra round-trip.
 *
 * US-5, EC-7
 */
export default async function WelcomePage() {
  const ctx = await createTRPCContext({ req: undefined as never })
  const caller = createCaller(ctx)
  const keys = await caller.apiKeys.list()

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Welcome to JobBobber</h1>
      <p className="mb-6 text-sm text-gray-500">
        Use your API key to connect job postings and receive match notifications.
      </p>

      <ApiKeyGenerator existingKeys={keys} />
    </>
  )
}
