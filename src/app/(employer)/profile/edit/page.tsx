"use client"

import { trpc } from "@/lib/trpc/client"
import { CompanyProfileForm } from "@/components/employer/company-profile-form"
import { LogoUpload } from "@/components/employer/logo-upload"

export default function EmployerProfileEditPage() {
  const { data: employer, isLoading } = trpc.employers.getMe.useQuery()

  if (isLoading) {
    return (
      <div data-testid="employer-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (!employer) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Company Profile</h1>
      <LogoUpload currentLogoUrl={employer.logoUrl} />
      <CompanyProfileForm employer={employer} />
    </div>
  )
}
