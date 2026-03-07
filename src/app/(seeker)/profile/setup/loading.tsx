/**
 * Suspense loading UI for /profile/setup.
 * Shown by Next.js while the page chunk / server data loads.
 */
export default function ProfileSetupLoading() {
  return (
    <div>
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
    </div>
  )
}
