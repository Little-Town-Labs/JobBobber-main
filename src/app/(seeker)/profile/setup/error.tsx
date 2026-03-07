"use client"

/**
 * Error boundary for /profile/setup.
 * Catches unexpected errors thrown by the profile page.
 */
export default function ProfileSetupError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div role="alert">
      <h2>Something went wrong loading your profile.</h2>
      <p>An unexpected error occurred. Please try again or contact support.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
