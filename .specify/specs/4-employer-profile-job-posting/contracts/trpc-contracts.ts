/**
 * tRPC Contract Types — 4-employer-profile-job-posting
 *
 * These types define the API surface for employer profile and job posting
 * management. They are NOT executable code — they document the expected
 * input/output shapes for implementation.
 */

// ---------------------------------------------------------------------------
// Employer Profile
// ---------------------------------------------------------------------------

/** Full employer profile returned to the owning employer. Omits BYOK key fields. */
interface FullEmployerProfile {
  id: string
  name: string
  description: string | null
  industry: string | null
  size: string | null
  culture: string | null
  headquarters: string | null
  locations: string[]
  websiteUrl: string | null
  urls: Record<string, string> // { label: url } pairs
  benefits: string[]
  logoUrl: string | null
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/** Public employer profile for job seekers. Same as full but no createdAt. */
interface PublicEmployerProfile {
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
  updatedAt: string
}

/** employers.updateProfile input */
interface UpdateEmployerProfileInput {
  name?: string // min 1, max 255
  description?: string // max 5000
  industry?: string // max 100
  size?: string // max 50
  culture?: string // max 5000
  headquarters?: string // max 255
  locations?: string[] // max 20 entries, each max 255
  websiteUrl?: string // z.string().url()
  urls?: Record<string, string> // max 10 entries
  benefits?: string[] // max 30 entries, each max 255
}

// ---------------------------------------------------------------------------
// Job Posting
// ---------------------------------------------------------------------------

/** Full job posting returned to the owning employer. */
interface FullJobPosting {
  id: string
  employerId: string
  title: string
  department: string | null
  description: string
  responsibilities: string | null
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE"
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT"
  locationType: "REMOTE" | "HYBRID" | "ONSITE"
  locationReq: string | null
  salaryMin: number | null
  salaryMax: number | null
  benefits: string[]
  whyApply: string | null
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "FILLED"
  createdAt: string
  updatedAt: string
}

/** Public job posting for job seekers (same fields; private settings excluded). */
type PublicJobPosting = Omit<FullJobPosting, "createdAt">

/** jobPostings.create input */
interface CreateJobPostingInput {
  title: string // min 1, max 255
  department?: string // max 100
  description: string // min 1, max 10000
  responsibilities?: string // max 5000
  requiredSkills: string[] // min 0, max 30, each max 100
  preferredSkills?: string[] // max 30, each max 100
  experienceLevel: "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE"
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT"
  locationType: "REMOTE" | "HYBRID" | "ONSITE"
  locationReq?: string // max 255
  salaryMin?: number // int, >= 0
  salaryMax?: number // int, >= salaryMin
  benefits?: string[] // max 20, each max 255
  whyApply?: string // max 5000
}

/** jobPostings.update input — all fields optional (partial update) */
interface UpdateJobPostingInput {
  id: string // cuid
  title?: string
  department?: string
  description?: string
  responsibilities?: string
  requiredSkills?: string[]
  preferredSkills?: string[]
  experienceLevel?: "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE"
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT"
  locationType?: "REMOTE" | "HYBRID" | "ONSITE"
  locationReq?: string
  salaryMin?: number
  salaryMax?: number
  benefits?: string[]
  whyApply?: string
}

/** jobPostings.updateStatus input */
interface UpdateStatusInput {
  id: string // cuid
  status: "ACTIVE" | "PAUSED" | "CLOSED" | "FILLED"
}

/** jobPostings.list input */
interface ListJobPostingsInput {
  cursor?: string // cuid for pagination
  limit?: number // 1-100, default 20
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "FILLED"
  experienceLevel?: "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE"
  locationType?: "REMOTE" | "HYBRID" | "ONSITE"
}

/** jobPostings.list output */
interface ListJobPostingsOutput {
  items: FullJobPosting[]
  nextCursor: string | null
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Logo Upload
// ---------------------------------------------------------------------------

/** Route handler: POST /api/employer/logo/upload */
// Uses Vercel Blob handleUpload pattern (same as resume upload).
// Accepted: image/png, image/jpeg, image/webp — max 2 MB.

// ---------------------------------------------------------------------------
// Procedure → Middleware mapping
// ---------------------------------------------------------------------------

// employers.getMe          → employerProcedure (any org member)
// employers.getById        → publicProcedure (public company profile)
// employers.updateProfile  → adminProcedure (org:admin only)
// employers.uploadLogo     → adminProcedure (org:admin only) — not tRPC, Route Handler

// jobPostings.list         → employerProcedure (own postings) / publicProcedure (active only)
// jobPostings.getById      → publicProcedure (active postings) / employerProcedure (own, any status)
// jobPostings.create       → employerProcedure (any role with posting rights — admin or job_poster)
// jobPostings.update       → employerProcedure
// jobPostings.updateStatus → employerProcedure
// jobPostings.delete       → employerProcedure (draft only)

export type {
  FullEmployerProfile,
  PublicEmployerProfile,
  UpdateEmployerProfileInput,
  FullJobPosting,
  PublicJobPosting,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  UpdateStatusInput,
  ListJobPostingsInput,
  ListJobPostingsOutput,
}
