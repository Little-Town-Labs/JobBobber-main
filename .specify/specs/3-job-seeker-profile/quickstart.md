# Quickstart — 3-job-seeker-profile

**Branch:** 3-job-seeker-profile
**Date:** 2026-02-24

---

## Prerequisites

Before implementing, confirm these are in place:

- [ ] Feature 1 (foundation): Prisma schema, tRPC setup, Vercel Blob configured
- [ ] Feature 2 (auth + BYOK): `seekerProcedure`, `SeekerSettings` row with encrypted BYOK key
- [ ] Branch: `3-job-seeker-profile` (already created)
- [ ] Environment variables: `BLOB_READ_WRITE_TOKEN`, `ENCRYPTION_KEY`, `ENCRYPTION_IV_SALT`

---

## Local Setup Validation

```bash
# 1. Confirm database is running and migrations are up to date
pnpm prisma migrate status

# 2. Run the existing test suite to confirm Feature 2 baseline is green
pnpm test --run

# 3. Confirm TypeScript compiles clean
pnpm lint
```

---

## Implementation Entry Points

### Step 1 — Database Migration

```bash
# Create the migration file
pnpm prisma migrate dev --name add-profile-urls-and-extraction-cache

# Verify the schema
pnpm prisma studio  # check job_seekers.profile_urls and extraction_cache table
```

Changes in `prisma/schema.prisma`:

- `profileUrls Json[] @default([])` on `JobSeeker`
- New `ExtractionCache` model (see `plan.md` §Phase 0)

---

### Step 2 — Shared Utilities (write tests first)

```bash
# Create the utility files
touch src/lib/profile-completeness.ts
touch src/lib/profile-completeness.test.ts
touch src/lib/skills-data.ts
touch src/lib/skills-data.test.ts

# Run tests (they will FAIL — that is correct at this stage)
pnpm test src/lib/profile-completeness.test.ts
```

The `computeProfileCompleteness` function signature:

```typescript
export function computeProfileCompleteness(seeker: {
  name: string
  headline: string | null
  bio: string | null
  experience: unknown[]
  skills: string[]
  education: unknown[]
  location: string | null
  resumeUrl: string | null
  profileUrls?: unknown[]
}): number
```

Scoring weights — total must equal 100:
| Field | Points | Condition |
|-------|--------|-----------|
| `name` | 15 | non-empty |
| `headline` | 15 | non-empty |
| `bio` | 10 | non-empty |
| `experience` | 20 | `.length >= 1` |
| `skills` | 15 | `.length >= 3` |
| `education` | 10 | `.length >= 1` |
| `resumeUrl` | 10 | non-null |
| `location` | 5 | non-empty |

---

### Step 3 — tRPC Routers (write tests first)

```bash
# Create new files
touch src/server/api/routers/resume.ts
touch src/server/api/routers/resume.test.ts

# Expand existing stub (tests first)
touch src/server/api/routers/jobSeekers.test.ts

# Register new router in root
# src/server/api/root.ts: add  resume: resumeRouter
```

Key test scenarios for `jobSeekers` router:

- `getMe`: returns `FullJobSeekerProfile` for authenticated seeker
- `getById`: returns `PublicJobSeekerProfile`; omits `resumeUrl`, `parsedResume`, SeekerSettings
- `updateProfile`: empty payload is no-op; array fields are full-replaced; completeness recalculated
- `setActiveStatus`: throws CONFLICT if already in requested state

Key test scenarios for `resume` router:

- `getUploadUrl`: rejects unsupported MIME types; rejects files > 10 MiB
- `confirmUpload`: rejects foreign blob hostname; sets `resumeUrl`; clears `parsedResume`
- `triggerExtraction`: PRECONDITION_FAILED if no BYOK key; BAD_REQUEST if blobUrl ≠ resumeUrl
- `applyExtraction`: FORBIDDEN if extractionId belongs to different seeker; NOT_FOUND if expired

---

### Step 4 — Route Handler

```bash
mkdir -p src/app/api/resume/upload
touch src/app/api/resume/upload/route.ts
```

The handler must:

1. Call `auth()` from `@clerk/nextjs/server` in `onBeforeGenerateToken`
2. Verify the user has a `JobSeeker` row (throw `Error` — not `TRPCError` — on failure)
3. Accept only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
4. Enforce max size 10 MiB
5. Set blob path: `resumes/{seekerId}/{timestamp}-{sanitizedFilename}`
6. Leave `onUploadCompleted` empty (persistence handled by `resume.confirmUpload`)

---

### Step 5 — Frontend

```bash
# Create profile page
mkdir -p src/app/\(seeker\)/profile/setup
touch src/app/\(seeker\)/profile/setup/page.tsx
touch src/app/\(seeker\)/profile/setup/loading.tsx

# Create components
mkdir -p src/components/profile
touch src/components/profile/profile-tabs.tsx
touch src/components/profile/completeness-card.tsx
touch src/components/profile/basic-info-form.tsx
touch src/components/profile/experience-form.tsx
touch src/components/profile/education-form.tsx
touch src/components/profile/skills-form.tsx
touch src/components/profile/urls-form.tsx
touch src/components/profile/location-form.tsx
touch src/components/profile/resume-upload-card.tsx
touch src/components/profile/resume-extraction-review.tsx
```

Component test files follow the same names with `.test.tsx` suffix.

---

## Validation Scenarios

### Scenario 1: First-time profile creation

1. Authenticated seeker navigates to `/profile/setup`
2. Page loads with `getMe` result (all fields null/empty), completeness = 0
3. Seeker fills Basic Info tab → clicks Save → `updateProfile` called → score updates
4. Seeker uploads resume → extraction proposed → seeker reviews → `applyExtraction` called
5. After completing all sections, score reaches ≥ 70 → agent activation becomes available

Expected state: `profileCompleteness >= 70`, all required fields non-null

### Scenario 2: Resume upload without BYOK key

1. Seeker uploads resume (POST `/api/resume/upload` → direct blob upload → `confirmUpload`)
2. Seeker triggers extraction: `resume.triggerExtraction` called
3. Expected: `PRECONDITION_FAILED` error returned
4. UI shows: "AI extraction requires an API key — [Configure API key]"
5. Resume is stored; seeker can fill fields manually

### Scenario 3: Access control

1. Seeker A calls `getById` with Seeker B's profile ID
2. Expected: `PublicJobSeekerProfile` returned (public read is allowed)
3. Expected: `resumeUrl` is absent from the response
4. Seeker A calls `updateProfile` — middleware enforces identity from `ctx.seeker` — Seeker A updates their own profile, not Seeker B's

### Scenario 4: Completeness boundary

1. Profile has: name, headline, bio, 1 experience, 3 skills, 1 education, location, resumeUrl
2. Expected completeness: 15 + 15 + 10 + 20 + 15 + 10 + 5 + 10 = 100
3. Profile missing skills (only 2): 15 + 15 + 10 + 20 + 0 + 10 + 5 + 10 = 85 (still above 70)
4. Profile with only name + headline: 15 + 15 = 30 — below 70, agent activation blocked

### Scenario 5: Re-upload replaces previous file

1. Seeker already has `resumeUrl` set
2. Seeker uploads new file → `confirmUpload` sets new `resumeUrl`, clears `parsedResume`
3. UI prompts: "Keep existing profile data, replace with newly extracted data, or merge?"
4. `applyExtraction` called with selected flags

---

## Common Pitfalls

**`pdf-parse` / `mammoth` must not be imported in client code.** Both are Node.js-only. If a client component accidentally imports a server file that imports these, Next.js will throw a bundle error. Use the `server-only` package guard on `src/server/api/routers/resume.ts`.

**Array fields are full-replacement.** The client must send the complete updated array, not a delta. The form components own the full array state and submit it on save.

**`profileUrls` vs `urls` naming.** The new Prisma field is `profileUrls`. The old field is `urls` (deprecated). Map them clearly in the router: read from `profileUrls`, ignore `urls`.

**Feature flag enforcement is at the layout/navigation layer, not in tRPC procedures.** The `(seeker)/layout.tsx` checks the `SEEKER_PROFILE` flag and redirects if disabled. The tRPC procedures do not check feature flags directly.
