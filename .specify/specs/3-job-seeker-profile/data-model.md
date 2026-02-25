# Data Model — 3-job-seeker-profile

**Branch:** 3-job-seeker-profile
**Date:** 2026-02-24

---

## Overview

All entities required for this feature are **already defined** in the Prisma schema
(established in Feature 1). This document describes the schema in context of what this
feature reads and writes, and documents the JSON sub-schemas for the `Json[]` fields.

No new Prisma migrations are required for this feature.

---

## Primary Entity: `JobSeeker`

Table: `job_seekers`

| Field                  | Type          | Nullable | Description                                                               |
| ---------------------- | ------------- | -------- | ------------------------------------------------------------------------- |
| `id`                   | String (cuid) | No       | Primary key                                                               |
| `clerkUserId`          | String        | No       | Unique — links to Clerk user                                              |
| `name`                 | String        | No       | Full name (required, min 1 char)                                          |
| `headline`             | String        | Yes      | Professional headline (max 255 chars)                                     |
| `bio`                  | String        | Yes      | Professional summary (max 2000 chars)                                     |
| `resumeUrl`            | String        | Yes      | Vercel Blob URL for uploaded resume file                                  |
| `parsedResume`         | Json          | Yes      | Raw parsed resume data from AI extraction (for reference / re-extraction) |
| `experience`           | Json[]        | No       | Array of `ExperienceEntry` objects (see sub-schema below)                 |
| `education`            | Json[]        | No       | Array of `EducationEntry` objects (see sub-schema below)                  |
| `skills`               | String[]      | No       | Flat array of skill strings (max 50)                                      |
| `urls`                 | String[]      | No       | **DEPRECATED** — replaced by structured URL objects in Feature 3          |
| `location`             | String        | Yes      | City/region free text                                                     |
| `relocationPreference` | String        | Yes      | Enum-like: one of four values (see below)                                 |
| `profileCompleteness`  | Float         | No       | 0.0–100.0 — recalculated on every profile write                           |
| `isActive`             | Boolean       | No       | false = profile excluded from matching                                    |
| `profileEmbedding`     | vector(1536)  | Yes      | pgvector field — populated in Feature 11                                  |
| `createdAt`            | DateTime      | No       | Row creation timestamp                                                    |
| `updatedAt`            | DateTime      | No       | Auto-updated on every write                                               |

**Indexes:** `clerkUserId` (unique), `isActive`, `location`

---

## Secondary Entity: `SeekerSettings`

Table: `seeker_settings`

One-to-one with `JobSeeker`. Created by Feature 2 (`onboarding.setRole`). Feature 3
reads the `byokApiKeyEncrypted` and `byokProvider` fields to perform AI extraction.
Feature 3 does NOT write to the private settings fields — that is deferred to Feature 8.

| Field                 | Feature Scope | Description                        |
| --------------------- | ------------- | ---------------------------------- |
| `id`                  | Feature 1     | Primary key                        |
| `seekerId`            | Feature 1     | FK → job_seekers.id                |
| `byokApiKeyEncrypted` | Feature 2     | Encrypted BYOK key for AI calls    |
| `byokProvider`        | Feature 2     | `"openai"` or `"anthropic"`        |
| `byokMaskedKey`       | Feature 2     | Display-safe masked key            |
| `minSalary`           | Feature 8     | Private — not touched in Feature 3 |
| `dealBreakers`        | Feature 8     | Private — not touched in Feature 3 |
| `priorities`          | Feature 8     | Private — not touched in Feature 3 |
| `exclusions`          | Feature 8     | Private — not touched in Feature 3 |
| `customPrompt`        | Feature 15    | Private — not touched in Feature 3 |

---

## JSON Sub-Schemas

### `ExperienceEntry` (stored in `experience` Json[] field)

```typescript
interface ExperienceEntry {
  id: string // client-generated cuid for stable array key
  jobTitle: string // required, max 255 chars
  company: string // required, max 255 chars
  startDate: string // ISO date "YYYY-MM" (month-year precision)
  endDate: string | null // ISO date "YYYY-MM", or null = "present"
  description: string // optional, max 2000 chars
}
```

**Validation (Zod):**

```typescript
const ExperienceEntrySchema = z
  .object({
    id: z.string().cuid(),
    jobTitle: z.string().min(1).max(255),
    company: z.string().min(1).max(255),
    startDate: z.string().regex(/^\d{4}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .nullable(),
    description: z.string().max(2000).default(""),
  })
  .refine(
    (data) => {
      if (data.endDate === null) return true
      return data.endDate >= data.startDate
    },
    { message: "End date must be after start date", path: ["endDate"] },
  )
```

---

### `EducationEntry` (stored in `education` Json[] field)

```typescript
interface EducationEntry {
  id: string // client-generated cuid
  institution: string // required, max 255 chars
  degree: string // e.g. "Bachelor of Science", max 255 chars
  field: string // e.g. "Computer Science", max 255 chars
  startDate: string // ISO date "YYYY-MM"
  endDate: string | null // null = in progress
  description: string // certifications, honors, max 1000 chars
}
```

---

### `ProfileUrl` (stored in `urls` String[] field — **CHANGE** in Feature 3)

The existing `urls` field is `String[]`. Feature 3 replaces this with structured objects
stored as `Json[]` to support labelled URLs. Since the field is `String[]` in the schema,
we store labelled URLs as a JSON field named `profileUrls` on the `parsedResume` Json field,
or we use a **DB migration** to add a new `profileUrls Json[]` field.

**Decision:** Add `profileUrls Json[]` field via migration in Feature 3.

```typescript
interface ProfileUrl {
  id: string // client-generated cuid
  label: string // e.g. "GitHub", "Portfolio", max 100 chars
  url: string // valid URL, max 512 chars
}
```

**Migration required:**

```prisma
// Add to JobSeeker model:
profileUrls Json[] @default([])
```

---

### `RelocationPreference` (stored in `relocationPreference` String field)

Permitted values (enforced by Zod, not a DB enum):

- `"NOT_OPEN"` — Not open to relocation
- `"DOMESTIC"` — Open to relocation within country
- `"INTERNATIONAL"` — Open to international relocation
- `"REMOTE_ONLY"` — Fully remote only

---

## Completeness Score Algorithm

Stored in `profileCompleteness Float`. Recalculated on every `updateProfile` mutation.

```
score = 0
if name is non-empty:              +10
if headline is non-empty:          +10
if bio is non-empty:               +10
if experience.length >= 1:         +20
if education.length >= 1:          +10
if skills.length >= 3:             +20
if resumeUrl is non-null:          +10
if location is non-empty:          +5
if profileUrls.length >= 1:        +5
──────────────────────────────────────
Total possible:                    100
```

The score is a Float (0.0–100.0). Agent activation requires score ≥ 70.0.

---

## Database Migration

One new field is required (see ProfileUrl decision above):

**Migration:** `add-profile-urls-to-job-seeker`

```sql
ALTER TABLE job_seekers
ADD COLUMN profile_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
```

Prisma schema addition:

```prisma
profileUrls  Json[]  @default([])
```

The existing `urls String[]` field is retained for backward compatibility and
**deprecated** — new code reads/writes `profileUrls`; `urls` is ignored after Feature 3.

---

## Data Flow Summary

```
Browser
  │
  ├─ Upload resume → /api/resume/upload (route handler)
  │                         │
  │                         └─ Vercel Blob → resumeUrl stored in JobSeeker
  │
  ├─ tRPC: jobSeekers.extractResume(resumeUrl)
  │         │
  │         ├─ Fetch resume text from Blob (via signed URL)
  │         ├─ Parse PDF/DOCX → plain text
  │         ├─ Decrypt BYOK key from SeekerSettings
  │         ├─ generateObject(schema, text) → structured extraction
  │         └─ Return { experience[], education[], skills[], headline }
  │
  ├─ tRPC: jobSeekers.updateProfile(data)
  │         │
  │         ├─ Validate Zod schemas
  │         ├─ Calculate completeness score
  │         └─ db.jobSeeker.update(...)
  │
  └─ tRPC: jobSeekers.getMe()
            └─ Return full profile (no SeekerSettings private fields)
```

---

## Privacy Boundaries

| Data                                         | Accessible by                                   | Not accessible by                |
| -------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| Public JobSeeker fields                      | The seeker, employer agents (read-only), public | Other job seekers                |
| parsedResume (Json)                          | The seeker only                                 | Employers, other seekers         |
| SeekerSettings.minSalary, dealBreakers, etc. | The seeker's agent (server-side only)           | Everyone else                    |
| byokApiKeyEncrypted                          | Server-side extraction only                     | Client, employers, other seekers |

---

## Environment Variables

No new environment variables are required for this feature beyond those established in Features 1 and 2.

Feature 3 uses:

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (Feature 1)
- `ENCRYPTION_KEY` + `ENCRYPTION_IV_SALT` — for BYOK key decryption (Feature 2)
