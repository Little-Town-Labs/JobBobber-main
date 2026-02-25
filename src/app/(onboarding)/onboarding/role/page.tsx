import { RoleSelectorForm } from "@/components/onboarding/role-selector"

/**
 * /onboarding/role — Step 1: choose Job Seeker or Employer.
 *
 * After submission, onboarding.setRole returns redirectTo: "/setup/api-key"
 * and the form's client-side router.push navigates to step 2.
 */
export default function RoleSelectionPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Welcome to JobBobber</h1>
      <p className="mb-6 text-gray-500">Tell us how you&apos;ll be using the platform.</p>
      <RoleSelectorForm />
    </div>
  )
}
