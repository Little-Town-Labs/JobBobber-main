import type { ReactNode } from "react"

/**
 * Onboarding layout — wraps /onboarding/* and /setup/* routes.
 *
 * Provides a centred, minimal shell appropriate for the two-step
 * onboarding flow (role selection → API key setup).
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">{children}</div>
    </main>
  )
}
