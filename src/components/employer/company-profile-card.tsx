"use client"

import Image from "next/image"
import Link from "next/link"

interface CompanyProfileCardProps {
  employer: {
    id: string
    name: string
    description: string | null
    industry: string | null
    size: string | null
    culture: string | null
    headquarters: string | null
    locations: string[]
    websiteUrl: string | null
    urls: Record<string, string>
    benefits: string[]
    logoUrl: string | null
  }
}

export function CompanyProfileCard({ employer }: CompanyProfileCardProps) {
  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-start gap-4">
        {employer.logoUrl && (
          <Image
            src={employer.logoUrl}
            alt={`${employer.name} logo`}
            width={64}
            height={64}
            className="rounded object-cover"
          />
        )}
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{employer.name}</h2>
          {(employer.industry || employer.size) && (
            <p className="text-sm text-gray-600">
              {employer.industry}
              {employer.industry && employer.size && " · "}
              {employer.size}
            </p>
          )}
          {employer.headquarters && (
            <p className="text-sm text-gray-500">{employer.headquarters}</p>
          )}
        </div>
        <Link href="/profile/edit" className="text-sm text-blue-600 hover:underline">
          Edit
        </Link>
      </div>

      {employer.description && <p className="mt-4 text-sm">{employer.description}</p>}

      {employer.benefits.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Benefits</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {employer.benefits.map((b) => (
              <span key={b} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
