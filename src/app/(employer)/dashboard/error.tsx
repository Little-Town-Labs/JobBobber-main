"use client"

export default function EmployerDashboardError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div role="alert">
      <h2>Something went wrong loading the dashboard.</h2>
      <p>An unexpected error occurred. Please try again or contact support.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
