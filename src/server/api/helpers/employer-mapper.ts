import "server-only"

/** Build FullEmployerProfile response from a Prisma row. Omits BYOK and internal fields. */
export function toFullEmployer(employer: {
  id: string
  name: string
  description: string | null
  industry: string | null
  size: string | null
  culture: string | null
  headquarters: string | null
  locations: string[]
  websiteUrl: string | null
  urls: unknown
  benefits: string[]
  logoUrl: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: employer.id,
    name: employer.name,
    description: employer.description,
    industry: employer.industry,
    size: employer.size,
    culture: employer.culture,
    headquarters: employer.headquarters,
    locations: employer.locations,
    websiteUrl: employer.websiteUrl,
    urls: employer.urls as Record<string, string>,
    benefits: employer.benefits,
    logoUrl: employer.logoUrl,
    createdAt: employer.createdAt.toISOString(),
    updatedAt: employer.updatedAt.toISOString(),
  }
}

/** Build PublicEmployerProfile — same as full but omits createdAt. */
export function toPublicEmployer(employer: Parameters<typeof toFullEmployer>[0]) {
  const { createdAt: _, ...rest } = toFullEmployer(employer)
  return rest
}

/** Build FullJobPosting response from a Prisma row. */
export function toFullJobPosting(posting: {
  id: string
  employerId: string
  title: string
  department: string | null
  description: string
  responsibilities: string | null
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: string
  employmentType: string
  locationType: string
  locationReq: string | null
  salaryMin: number | null
  salaryMax: number | null
  benefits: string[]
  whyApply: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: posting.id,
    employerId: posting.employerId,
    title: posting.title,
    department: posting.department,
    description: posting.description,
    responsibilities: posting.responsibilities,
    requiredSkills: posting.requiredSkills,
    preferredSkills: posting.preferredSkills,
    experienceLevel: posting.experienceLevel,
    employmentType: posting.employmentType,
    locationType: posting.locationType,
    locationReq: posting.locationReq,
    salaryMin: posting.salaryMin,
    salaryMax: posting.salaryMax,
    benefits: posting.benefits,
    whyApply: posting.whyApply,
    status: posting.status,
    createdAt: posting.createdAt.toISOString(),
    updatedAt: posting.updatedAt.toISOString(),
  }
}

/** Build PublicJobPosting — same as full but omits createdAt. */
export function toPublicJobPosting(posting: Parameters<typeof toFullJobPosting>[0]) {
  const { createdAt: _, ...rest } = toFullJobPosting(posting)
  return rest
}
