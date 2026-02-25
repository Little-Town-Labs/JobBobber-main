# Task Breakdown — 3-job-seeker-profile

**Branch:** 3-job-seeker-profile
**Plan:** .specify/specs/3-job-seeker-profile/plan.md
**Date:** 2026-02-24

---

## Summary

| Phase     | Name                      | Tasks  | Effort    |
| --------- | ------------------------- | ------ | --------- |
| 0         | Database Migration        | 1      | 1 h       |
| 1         | Shared Utilities          | 4      | 3.5 h     |
| 2         | tRPC Routers              | 5      | 14.5 h    |
| 3         | Route Handler             | 2      | 2.5 h     |
| 4         | Frontend                  | 16     | 22 h      |
| 5         | Security & Hardening      | 3      | 2.5 h     |
| 6         | Integration, E2E & Review | 3      | 5 h       |
| **Total** |                           | **34** | **~51 h** |

---

## Critical Path

```
0.1 → 1.1 → 1.2 → 2.1 → 2.2 → 4.1 → 4.2 → 4.15 → 4.16 → 5.1 → 6.1 → 6.2 → 6.3
```

With parallelization (1.3‖1.1, 2.3‖2.1, 4.3–4.14 parallel after 4.2):
**Critical path duration: ~26 h**

---

## Phase 0: Database Migration

### Task 0.1: Prisma Schema — Migration

**Status:** 🟡 Ready
**Effort:** 1 h
**Dependencies:** None

**Description:**
Add `profileUrls Json[] @default([])` to `JobSeeker` and create the `ExtractionCache` model. Run `pnpm prisma migrate dev` and verify the generated SQL is correct.

**Prisma additions:**

```prisma
// On JobSeeker model:
profileUrls Json[] @default([])
extractionCache ExtractionCache[]

// New model:
model ExtractionCache {
  id        String    @id @default(cuid())
  seekerId  String
  proposed  Json
  expiresAt DateTime
  createdAt DateTime  @default(now())
  seeker    JobSeeker @relation(fields: [seekerId], references: [id], onDelete: Cascade)
  @@index([seekerId])
  @@index([expiresAt])
  @@map("extraction_cache")
}
```

**Acceptance Criteria:**

- [ ] `pnpm prisma migrate dev --name add-profile-urls-and-extraction-cache` succeeds
- [ ] `pnpm prisma generate` produces updated client
- [ ] `pnpm prisma studio` shows `profile_urls` column on `job_seekers` and `extraction_cache` table
- [ ] Migration SQL is committed

---

## Phase 1: Shared Utilities

### Task 1.1: Profile Completeness Utility — Tests

**Status:** 🔴 Blocked by 0.1
**Effort:** 1 h
**Dependencies:** Task 0.1
**Parallel with:** Task 1.3

**Description:**
Write tests for `src/lib/profile-completeness.ts` **before any implementation exists**. Tests must FAIL when first run.

**File:** `src/lib/profile-completeness.test.ts`

**Test cases:**

- All fields populated → score = 100
- All fields empty → score = 0
- Name + headline only → score = 30
- Exactly at threshold: minimum fields summing to 70 → score = 70 (agent activation enabled)
- Just below threshold: fields summing to 65 → score = 65 (agent activation blocked)
- `skills.length = 2` (below minimum of 3) → skills contribute 0
- `skills.length = 3` (at minimum) → skills contribute 15
- `experience.length = 0` → experience contributes 0
- `experience.length = 1` → experience contributes 20
- `resumeUrl = null` → resumeUrl contributes 0
- `resumeUrl` set → resumeUrl contributes 10
- Return type is a number in [0, 100]

**Scoring weights (total must equal 100):**
| Field | Points | Condition |
|-------|--------|-----------|
| `name` | 15 | non-empty string |
| `headline` | 15 | non-empty string |
| `bio` | 10 | non-empty string |
| `experience` | 20 | `.length >= 1` |
| `skills` | 15 | `.length >= 3` |
| `education` | 10 | `.length >= 1` |
| `resumeUrl` | 10 | non-null |
| `location` | 5 | non-empty string |

**Acceptance Criteria:**

- [ ] Test file exists at `src/lib/profile-completeness.test.ts`
- [ ] All test cases listed above are covered
- [ ] `pnpm test src/lib/profile-completeness.test.ts` runs and FAILS (no implementation yet)

---

### Task 1.2: Profile Completeness Utility — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 1 h
**Dependencies:** Task 1.1

**Description:**
Implement `src/lib/profile-completeness.ts` to pass the tests from Task 1.1.

**File:** `src/lib/profile-completeness.ts`

```typescript
// Signature:
export interface ProfileCompletenessInput {
  name: string
  headline: string | null
  bio: string | null
  experience: unknown[]
  skills: string[]
  education: unknown[]
  location: string | null
  resumeUrl: string | null
}

export function computeProfileCompleteness(seeker: ProfileCompletenessInput): number
```

**Acceptance Criteria:**

- [ ] All tests from Task 1.1 pass
- [ ] Function is a pure function (no DB access, no side effects)
- [ ] Return value is always in range [0, 100]
- [ ] Exported from the file (named export)
- [ ] No console.log statements

---

### Task 1.3: Skills Data Module — Tests

**Status:** 🔴 Blocked by 0.1
**Effort:** 0.5 h
**Dependencies:** Task 0.1
**Parallel with:** Task 1.1

**Description:**
Write tests for `src/lib/skills-data.ts` before the file exists. Tests must FAIL.

**File:** `src/lib/skills-data.test.ts`

**Test cases:**

- `SKILLS` export exists and is a non-empty array
- `SKILLS.length >= 100` (curated list)
- All entries are strings
- No duplicate entries
- Array is sorted (case-insensitive lexicographic order)
- No empty strings in the list

**Acceptance Criteria:**

- [ ] Test file exists at `src/lib/skills-data.test.ts`
- [ ] All test cases listed above are covered
- [ ] `pnpm test src/lib/skills-data.test.ts` runs and FAILS

---

### Task 1.4: Skills Data Module — Implementation

**Status:** 🔴 Blocked by 1.3
**Effort:** 1 h
**Dependencies:** Task 1.3
**Parallel with:** Task 1.2

**Description:**
Create `src/lib/skills-data.ts` with a curated static list of ~500 skills. The list should cover: software engineering (languages, frameworks, tools), design, product management, marketing, data science, operations, and finance.

**File:** `src/lib/skills-data.ts`

```typescript
export const SKILLS: string[] = [
  // sorted, deduplicated skill strings
  "Agile",
  "Angular",
  "AWS",
  // ... ~500 entries
]
```

**Acceptance Criteria:**

- [ ] All tests from Task 1.3 pass
- [ ] List is sorted (case-insensitive)
- [ ] No duplicates
- [ ] At least 200 entries covering multiple disciplines
- [ ] Server-only import (add `import "server-only"` guard if used in server modules — but this file is also safe to import on the client for autocomplete, so no guard needed)

---

## Phase 2: tRPC Routers

### Task 2.1: jobSeekers Router — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2 h
**Dependencies:** Task 1.2
**Parallel with:** Task 2.3

**Description:**
Write tests for the four procedures in `src/server/api/routers/jobSeekers.ts`. Tests must FAIL (the procedures are currently stubs that return null).

**File:** `src/server/api/routers/jobSeekers.test.ts`

**Test cases per procedure:**

`getMe`:

- Returns `FullJobSeekerProfile` shape for authenticated seeker
- `parsedResume` field is NOT in the response
- SeekerSettings fields are NOT in the response
- `profileCompleteness` is a number in [0, 100]

`getById`:

- Returns `PublicJobSeekerProfile` for valid id
- `resumeUrl` is NOT in the response
- `parsedResume` is NOT in the response
- `createdAt` is NOT in the response
- SeekerSettings fields are NOT in the response
- Throws NOT_FOUND for unknown id
- Returns profile even when `isActive = false`

`updateProfile`:

- Empty input `{}` is a valid no-op call
- `name` update sets the field and recalculates `profileCompleteness`
- `experience` update is full-replacement (not append)
- `skills` array capped at 50 entries
- `urls` array capped at 10 entries
- Invalid URL in `urls` throws BAD_REQUEST
- `endDate` before `startDate` in experience entry throws BAD_REQUEST
- Returns `FullJobSeekerProfile` after update

`setActiveStatus`:

- Sets `isActive = true` on an inactive profile → returns updated status
- Sets `isActive = false` on an active profile → returns updated status
- Setting `isActive = true` on already-active profile → throws CONFLICT
- Setting `isActive = false` on already-inactive profile → throws CONFLICT

**Acceptance Criteria:**

- [ ] Test file exists at `src/server/api/routers/jobSeekers.test.ts`
- [ ] All procedures have test coverage
- [ ] Prisma client is mocked (not live DB)
- [ ] `pnpm test src/server/api/routers/jobSeekers.test.ts` FAILS

---

### Task 2.2: jobSeekers Router — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 3 h
**Dependencies:** Task 2.1

**Description:**
Implement the four procedures in `src/server/api/routers/jobSeekers.ts`, replacing the existing stubs.

**Key implementation notes:**

- `getMe`: Use `ctx.seeker` (injected by `enforceSeeker` middleware). Parse `experience` and `education` JSON fields through their Zod schemas before returning. Use explicit Prisma `select` — no `parsedResume` or `byokApiKeyEncrypted`.
- `getById`: Use explicit Prisma `select` to exclude `resumeUrl`, `parsedResume`, and do NOT include SeekerSettings. Throw `TRPCError({ code: "NOT_FOUND" })` if no row.
- `updateProfile`: Build partial update object from input keys. Use `prisma.$transaction` to update the row and immediately compute + store `profileCompleteness`. Array fields are full-replace.
- `setActiveStatus`: Read `ctx.seeker.isActive`. Throw CONFLICT if already in requested state. Update single field, no completeness recalculation.

**Acceptance Criteria:**

- [ ] All tests from Task 2.1 pass
- [ ] `computeProfileCompleteness` from Task 1.2 is called in `updateProfile`
- [ ] No `*` selects on JobSeeker in `getById` — explicit field list only
- [ ] `profileUrls` mapped correctly (Prisma column is `profileUrls`, input key is `urls` in schema — document mapping clearly in a comment)

---

### Task 2.3: resume Router — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 3 h
**Dependencies:** Task 1.2
**Parallel with:** Task 2.1

**Description:**
Write tests for the four procedures in `src/server/api/routers/resume.ts` (new file). Tests must FAIL (file does not exist yet).

**File:** `src/server/api/routers/resume.test.ts`

**Test cases per procedure:**

`getUploadUrl`:

- Returns `{ uploadUrl, blobPath, expiresAt }` for valid PDF MIME + size
- Returns `{ uploadUrl, blobPath, expiresAt }` for valid DOCX MIME + size
- Throws BAD_REQUEST for unsupported MIME type (e.g., `image/png`)
- Throws BAD_REQUEST for file exceeding 10 MiB (10_485_761 bytes)
- `blobPath` follows pattern `resumes/{seekerId}/{timestamp}-{sanitizedFilename}`
- Filename is sanitised (strips path separators)

`confirmUpload`:

- Throws BAD_REQUEST if `blobUrl` hostname does not match `BLOB_STORE_HOSTNAME`
- Sets `resumeUrl` on the seeker row
- Clears `parsedResume` to null
- Calls `computeProfileCompleteness` and persists updated score
- Returns `FullJobSeekerProfile`

`triggerExtraction`:

- Throws PRECONDITION_FAILED if `SeekerSettings.byokApiKeyEncrypted` is null
- Throws BAD_REQUEST if `blobUrl` does not match `ctx.seeker.resumeUrl`
- On success: creates an `ExtractionCache` row and returns `ResumeExtractionResult` with `success: true`
- On AI provider error: returns `ResumeExtractionResult` with `success: false` and sanitised `errorReason`
- Enforces 30-second timeout on AI call (test via mocked timer)
- AI provider error message does NOT include raw exception stack or API key substring
- Does NOT write any extraction values to `JobSeeker` directly

`applyExtraction`:

- Throws NOT_FOUND if `extractionId` does not exist or has expired
- Throws FORBIDDEN if `extractionCache.seekerId !== ctx.seeker.id`
- With `applyHeadline: true` — sets `headline` on the seeker row
- With `applyExperience: true` — replaces `experience` array
- With `mergeSkills: true` — unions existing and extracted skills (capped at 50)
- With `mergeSkills: false` and `applySkills: true` — replaces skills
- Deletes the `ExtractionCache` row after successful application
- Calls `computeProfileCompleteness` and persists updated score
- Returns `FullJobSeekerProfile`

**Acceptance Criteria:**

- [ ] Test file exists at `src/server/api/routers/resume.test.ts`
- [ ] All procedures have test coverage
- [ ] Vercel AI SDK `generateObject` is mocked
- [ ] Vercel Blob `handleUpload` is mocked
- [ ] `pnpm test src/server/api/routers/resume.test.ts` FAILS

---

### Task 2.4: resume Router — Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 5 h
**Dependencies:** Task 2.3

**Description:**
Create `src/server/api/routers/resume.ts` with the four procedures. This is the most complex implementation task.

**New dependencies to install:**

```bash
pnpm add pdf-parse mammoth
pnpm add -D @types/pdf-parse @types/mammoth
```

**Key implementation notes:**

`getUploadUrl`:

- Import `handleUpload` from `@vercel/blob/client`
- Sanitise filename: `filename.replace(/[^a-zA-Z0-9._-]/g, "_")`
- Use `seekerId` from `ctx.seeker.id` in the blob path

`confirmUpload`:

- Validate `blobUrl` starts with `https://${process.env.BLOB_STORE_HOSTNAME}`
- Use `prisma.$transaction` to update `resumeUrl`, clear `parsedResume`, recalculate completeness

`triggerExtraction`:

- Read `seekerSettings = await ctx.db.seekerSettings.findUnique({ where: { seekerId: ctx.seeker.id } })`
- If `!seekerSettings?.byokApiKeyEncrypted` → throw PRECONDITION_FAILED
- Fetch resume file from blob URL with `fetch(blobUrl)`
- Detect content type from blob response headers
- Parse text: PDF → `pdf-parse`, DOCX → `mammoth.extractRawText`
- Decrypt BYOK key: `decrypt(seekerSettings.byokApiKeyEncrypted, ctx.seeker.clerkUserId)`
- Build AI model instance: `createOpenAI({ apiKey })` or `createAnthropic({ apiKey })`
- Call `generateObject({ model, schema: extractionSchema, prompt })` with `AbortController` (30s)
- Create `ExtractionCache` row with `expiresAt = new Date(Date.now() + 15 * 60 * 1000)`
- Return `{ extractionId, proposed, success: true }`

`applyExtraction`:

- Fetch cache: verify `expiresAt > new Date()` and `seekerId === ctx.seeker.id`
- Build partial update from approved flags
- Merge or replace skills as requested
- Delete cache entry, recompute completeness, return `FullJobSeekerProfile`

The extraction Zod schema passed to `generateObject`:

```typescript
const extractionSchema = z.object({
  headline: z.string().max(255).optional(),
  experience: z.array(ExperienceEntrySchema.omit({ id: true })).optional(),
  education: z.array(EducationEntrySchema.omit({ id: true })).optional(),
  skills: z.array(z.string().min(1).max(100)).max(50).optional(),
})
```

(Omit `id` from entry schemas — assign client-side cuids after extraction in the review UI.)

**Acceptance Criteria:**

- [ ] All tests from Task 2.3 pass
- [ ] `pdf-parse` and `mammoth` installed
- [ ] `import "server-only"` at top of file (prevents accidental client import)
- [ ] AI provider error logged to server console but sanitised before returning to client
- [ ] No decrypted key or resume text in any log statement

---

### Task 2.5: Register resumeRouter in root.ts

**Status:** 🔴 Blocked by 2.2, 2.4
**Effort:** 0.5 h
**Dependencies:** Tasks 2.2, 2.4

**Description:**
Add `resume: resumeRouter` to `src/server/api/root.ts`.

**Acceptance Criteria:**

- [ ] `src/server/api/root.ts` imports `resumeRouter` from `./routers/resume`
- [ ] `resume` key added to the `appRouter` object
- [ ] `pnpm lint` passes
- [ ] TypeScript infers `trpc.resume.*` procedures correctly

---

## Phase 3: Route Handler

### Task 3.1: Resume Upload Route Handler — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1 h
**Dependencies:** Task 2.2
**Parallel with:** Task 2.3

**Description:**
Write tests for `src/app/api/resume/upload/route.ts` before the file exists.

**File:** `tests/unit/api/resume-upload.test.ts`

**Test cases:**

- Unauthenticated request → 401 response
- Authenticated user with no `JobSeeker` row → 403 response
- Valid request from authenticated job seeker → returns client token (200)
- Unsupported MIME type in token request → 400 response
- File size exceeding 10 MiB → 400 response

**Acceptance Criteria:**

- [ ] Test file exists
- [ ] Clerk `auth()` is mocked
- [ ] Vercel `handleUpload` is mocked
- [ ] `pnpm test tests/unit/api/resume-upload.test.ts` FAILS

---

### Task 3.2: Resume Upload Route Handler — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 h
**Dependencies:** Task 3.1

**Description:**
Create `src/app/api/resume/upload/route.ts`.

```typescript
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/server/db"

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody
  return handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const { userId } = await auth()
      if (!userId) throw new Error("Unauthorized")
      const seeker = await db.jobSeeker.findUnique({ where: { clerkUserId: userId } })
      if (!seeker) throw new Error("Job seeker account not found")
      return {
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maximumSizeInBytes: 10 * 1024 * 1024,
        tokenPayload: JSON.stringify({ seekerId: seeker.id }),
      }
    },
    onUploadCompleted: async () => {
      // Intentionally empty — URL persistence handled by tRPC resume.confirmUpload
    },
  })
}
```

**Acceptance Criteria:**

- [ ] All tests from Task 3.1 pass
- [ ] MIME type and size enforcement in `onBeforeGenerateToken`
- [ ] `onUploadCompleted` is empty (documented comment explaining why)
- [ ] No DB writes in the route handler

---

## Phase 4: Frontend

### Task 4.1: Profile Page Scaffold — Tests

**Status:** 🔴 Blocked by 2.2, 2.4, 2.5, 3.2
**Effort:** 1.5 h
**Dependencies:** Tasks 2.5, 3.2

**Description:**
Write tests for the top-level profile page and completeness card before any UI files exist.

**Files:**

- `tests/unit/components/profile/profile-tabs.test.tsx`
- `tests/unit/components/profile/completeness-card.test.tsx`
- `tests/unit/app/profile/setup/page.test.tsx`

**Test cases:**

`profile-tabs`:

- Renders all 6 tabs (Basic Info, Experience, Education, Skills, URLs, Location)
- Active tab matches `?tab` search param (defaults to `basic`)
- Clicking a tab updates the URL search param

`completeness-card`:

- Shows numeric score (e.g., "45%")
- Shows progress bar with correct fill
- At score ≥ 70: shows "Agent activation available" or equivalent
- At score < 70: shows "X more points needed" or equivalent
- Lists each incomplete section with correct point values
- Incomplete section items are clickable links to corresponding tabs

`page`:

- Renders `ProfileTabs` and `CompletenessCard`
- Passes `getMe` data to child components
- Shows loading skeleton while `getMe` is pending

**Acceptance Criteria:**

- [ ] Test files exist
- [ ] tRPC `getMe` is mocked
- [ ] `pnpm test tests/unit/components/profile/` FAILS

---

### Task 4.2: Profile Page Scaffold — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1.5 h
**Dependencies:** Task 4.1

**Description:**
Create the profile page shell with tabs and completeness card. This is the container into which section forms plug.

**Files:**

```
src/app/(seeker)/profile/setup/page.tsx
src/app/(seeker)/profile/setup/loading.tsx
src/app/(seeker)/profile/setup/error.tsx
src/components/profile/profile-tabs.tsx
src/components/profile/completeness-card.tsx
```

**Implementation notes:**

- `page.tsx` fetches `getMe` via tRPC and passes the result to the tabbed layout
- Tab state managed via `useSearchParams()` + `useRouter()` from `next/navigation`
- Default tab: `basic` when `?tab` param is absent
- `completeness-card.tsx` shows score, progress bar, and missing-section checklist

**Acceptance Criteria:**

- [ ] All tests from Task 4.1 pass
- [ ] `/profile/setup` route renders without error
- [ ] Changing `?tab=experience` displays the experience section
- [ ] Completeness card reflects `profileCompleteness` from `getMe` response

---

### Task 4.3: BasicInfoForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.5, 4.7, 4.9, 4.11, 4.13

**Description:**
Write tests for `src/components/profile/basic-info-form.tsx`.

**Test cases:**

- Renders with initial values populated from `getMe` data
- Submit calls `updateProfile` with `{ name, headline, bio }` payload
- `name` field is required — shows inline error on empty submit
- `headline` max 255 chars — shows inline error when exceeded
- `bio` max 2000 chars — shows inline error when exceeded
- Loading state shown during mutation
- Success: shows success toast/confirmation
- API error: shows inline error message

**Acceptance Criteria:**

- [ ] Test file exists
- [ ] `updateProfile` mutation is mocked
- [ ] All test cases pass → FAIL before implementation

---

### Task 4.4: BasicInfoForm — Implementation

**Status:** 🔴 Blocked by 4.3
**Effort:** 1 h
**Dependencies:** Task 4.3

**Description:**
Create `src/components/profile/basic-info-form.tsx`. Uses `react-hook-form` + Zod resolver. Calls `trpc.jobSeekers.updateProfile.useMutation()`.

**Fields:** `name` (required), `headline` (optional, max 255), `bio` (optional, max 2000, textarea)

**Acceptance Criteria:**

- [ ] All tests from Task 4.3 pass
- [ ] Form validation matches constraints in `UpdateProfileInputSchema`
- [ ] Submit payload contains only the three basic info fields (no other keys)

---

### Task 4.5: ExperienceForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.3, 4.7, 4.9, 4.11, 4.13

**Description:**
Write tests for `src/components/profile/experience-form.tsx`.

**Test cases:**

- Renders existing entries in reverse chronological order
- "Add experience" button adds a blank entry form
- Can edit `jobTitle`, `company`, `startDate`, `endDate`, `description` on an entry
- `endDate` = "present" renders correctly (checkbox or "Present" toggle)
- End date before start date shows inline error
- "Remove" deletes entry from local state (confirmed before calling mutation)
- Submit sends the full updated array to `updateProfile`
- Max description 2000 chars — shows inline error

**Acceptance Criteria:**

- [ ] Test file exists
- [ ] `updateProfile` is mocked
- [ ] All test cases → FAIL before implementation

---

### Task 4.6: ExperienceForm — Implementation

**Status:** 🔴 Blocked by 4.5
**Effort:** 2 h
**Dependencies:** Task 4.5

**Description:**
Create `src/components/profile/experience-form.tsx`. Uses `useFieldArray` from `react-hook-form` for the entry list. New entries get a client-generated cuid for `id`. On save, sends the complete array to `updateProfile({ experience: [...] })`.

**Acceptance Criteria:**

- [ ] All tests from Task 4.5 pass
- [ ] Entries displayed in reverse-chronological order
- [ ] "Present" toggling sets `endDate: "present"` or null correctly
- [ ] Date range validation (end ≥ start) enforced in Zod resolver

---

### Task 4.7: EducationForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.3, 4.5, 4.9, 4.11, 4.13

**Description:**
Write tests for `src/components/profile/education-form.tsx`. Same pattern as experience form.

**Test cases:**

- Renders existing entries
- Add/edit/remove entries
- Fields: `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate`, `description`
- `endDate` = "present" for in-progress education
- Submit sends complete array to `updateProfile`
- Max description 1000 chars

**Acceptance Criteria:**

- [ ] Test file exists, all cases → FAIL

---

### Task 4.8: EducationForm — Implementation

**Status:** 🔴 Blocked by 4.7
**Effort:** 1.5 h
**Dependencies:** Task 4.7

**Description:**
Create `src/components/profile/education-form.tsx`. Same pattern as `ExperienceForm`.

**Acceptance Criteria:**

- [ ] All tests from Task 4.7 pass

---

### Task 4.9: SkillsForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.3, 4.5, 4.7, 4.11, 4.13

**Description:**
Write tests for `src/components/profile/skills-form.tsx`.

**Test cases:**

- Renders existing skills as removable tags
- Autocomplete dropdown shows matching suggestions from `SKILLS` list when typing
- Free-text skills not in the list can be added
- Adding a skill appends to the tag list
- Removing a tag removes from the list
- Maximum 50 skills — "Add" button disabled at limit; shows inline message
- Submit sends complete skills array to `updateProfile`
- Autocomplete is accessible via keyboard (arrow keys, Enter to select)

**Acceptance Criteria:**

- [ ] Test file exists, all cases → FAIL

---

### Task 4.10: SkillsForm — Implementation

**Status:** 🔴 Blocked by 4.9
**Effort:** 1.5 h
**Dependencies:** Task 4.9

**Description:**
Create `src/components/profile/skills-form.tsx`. Autocomplete filters the static `SKILLS` array client-side. Skills displayed as `Badge` components with remove button. Uses `combobox` pattern (Radix UI or shadcn/ui Combobox).

**Acceptance Criteria:**

- [ ] All tests from Task 4.9 pass
- [ ] Keyboard navigation works (arrow keys + Enter)
- [ ] 50-skill cap enforced in UI

---

### Task 4.11: UrlsForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.3, 4.5, 4.7, 4.9, 4.13

**Description:**
Write tests for `src/components/profile/urls-form.tsx`.

**Test cases:**

- Renders existing profile URLs as labelled link entries
- Each entry has a `label` input and a `url` input
- Invalid URL format shows inline error
- Empty label allowed (defaults to domain)
- Adding a URL appends a new entry form
- Removing deletes from local state
- Maximum 10 URLs — "Add" button disabled at limit
- Submit sends complete `profileUrls` array to `updateProfile`

**Acceptance Criteria:**

- [ ] Test file exists, all cases → FAIL

---

### Task 4.12: UrlsForm — Implementation

**Status:** 🔴 Blocked by 4.11
**Effort:** 1.5 h
**Dependencies:** Task 4.11

**Description:**
Create `src/components/profile/urls-form.tsx`. The form sends structured `{ id, label, url }` objects via `updateProfile({ profileUrls: [...] })`.

Note: The `UpdateProfileInputSchema` in the contracts uses `urls` as the input key — in the router implementation, this maps to the `profileUrls` DB column. The frontend form component sends data under the key the router expects. Confirm mapping is consistent with Task 2.2 before implementing.

**Acceptance Criteria:**

- [ ] All tests from Task 4.11 pass
- [ ] 10-URL cap enforced
- [ ] URL validation matches `z.string().url()` constraint

---

### Task 4.13: LocationForm — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 0.5 h
**Dependencies:** Task 4.2
**Parallel with:** Tasks 4.3, 4.5, 4.7, 4.9, 4.11

**Description:**
Write tests for `src/components/profile/location-form.tsx`.

**Test cases:**

- Renders existing `location` and `relocationPreference` values
- `location` free-text input, max 255 chars
- `relocationPreference` renders as a select/radio with all four options
- Submit calls `updateProfile({ location, relocationPreference })`

**Acceptance Criteria:**

- [ ] Test file exists, all cases → FAIL

---

### Task 4.14: LocationForm — Implementation

**Status:** 🔴 Blocked by 4.13
**Effort:** 1 h
**Dependencies:** Task 4.13

**Description:**
Create `src/components/profile/location-form.tsx`. Relocation preference options: `NOT_OPEN`, `DOMESTIC`, `INTERNATIONAL`, `REMOTE_ONLY` (display labels: "Not open to relocation", "Open to domestic relocation", "Open to international relocation", "Fully remote only").

**Acceptance Criteria:**

- [ ] All tests from Task 4.13 pass
- [ ] All four relocation options rendered correctly

---

### Task 4.15: ResumeUploadCard + ExtractionReview — Tests

**Status:** 🔴 Blocked by 2.4, 3.2, 4.2
**Effort:** 1.5 h
**Dependencies:** Tasks 2.4, 3.2, 4.2

**Description:**
Write tests for `src/components/profile/resume-upload-card.tsx` and `src/components/profile/resume-extraction-review.tsx`.

**`resume-upload-card` test cases:**

- Shows "Upload Resume" button when no `resumeUrl` exists
- Shows current resume filename when `resumeUrl` is set
- File type validation: rejects non-PDF/DOCX with error message
- File size validation: rejects > 10 MB with error message
- Upload in progress: shows progress/loading state
- After upload: shows "Extract with AI" button (if BYOK key exists)
- After upload: shows "No API key — [Configure]" message (if no BYOK key)
- `resume.triggerExtraction` error: shows error message, does not navigate away

**`resume-extraction-review` test cases:**

- Renders proposed headline, experience, education, skills
- Each section has an "Apply this section" checkbox
- "Apply All" button selects all checkboxes
- Skills section shows `mergeSkills` toggle ("Merge" vs "Replace")
- Submit calls `resume.applyExtraction` with correct flags
- Shows loading state during `applyExtraction` mutation
- On success: closes review panel, shows updated profile data

**Acceptance Criteria:**

- [ ] Test files exist, all cases → FAIL

---

### Task 4.16: ResumeUploadCard + ExtractionReview — Implementation

**Status:** 🔴 Blocked by 4.15
**Effort:** 2.5 h
**Dependencies:** Task 4.15

**Description:**
Create both components:

**`resume-upload-card.tsx`:**

1. Render a `<input type="file">` (accept: `.pdf,.docx`)
2. Validate type + size before calling `resume.getUploadUrl`
3. Use the returned `uploadUrl` to PUT directly to Vercel Blob: `await fetch(uploadUrl, { method: "PUT", body: file })`
4. After successful upload, call `resume.confirmUpload({ blobUrl: resultUrl })`
5. Show "Extract" button; on click, call `resume.triggerExtraction`
6. On extraction result: render `ResumeExtractionReview` with proposed data
7. On PRECONDITION_FAILED: show configure-key prompt

**`resume-extraction-review.tsx`:**

- Receive `extractionId` + `proposed` as props
- Checkboxes for headline, experience, education, skills
- `mergeSkills` toggle (default: merge = true)
- Submit → `resume.applyExtraction`

**Acceptance Criteria:**

- [ ] All tests from Task 4.15 pass
- [ ] File validation happens before any API calls
- [ ] `PRECONDITION_FAILED` case handled with actionable message
- [ ] Extraction review panel is keyboard accessible

---

## Phase 5: Security & Hardening

### Task 5.1: Security Review

**Status:** 🔴 Blocked by 2.2, 2.4, 3.2
**Effort:** 1 h
**Dependencies:** Tasks 2.2, 2.4, 3.2

**Description:**
Run `/security-review` on the router files and route handler. Address all CRITICAL and HIGH findings before proceeding to integration tests.

**Checklist:**

- [ ] `byokApiKeyEncrypted` does not appear in any response object
- [ ] Resume text content not logged anywhere
- [ ] Decrypted API key not logged anywhere
- [ ] AI provider error in `triggerExtraction` is sanitised (no stack trace, no key substring)
- [ ] `blobUrl` hostname validated in `confirmUpload`
- [ ] `blobUrl` ownership validated in `triggerExtraction` (must match `ctx.seeker.resumeUrl`)
- [ ] `ExtractionCache` ownership validated in `applyExtraction`
- [ ] `getById` Prisma `select` does not include `resumeUrl`, `parsedResume`, or any SeekerSettings field
- [ ] Route handler throws on unauthenticated / missing-seeker requests before issuing token
- [ ] No OWASP Top 10 violations

**Acceptance Criteria:**

- [ ] Security review completed
- [ ] All CRITICAL and HIGH findings resolved
- [ ] Checklist above fully checked

---

### Task 5.2: ExtractionCache Cleanup — Tests

**Status:** 🔴 Blocked by 2.4
**Effort:** 0.5 h
**Dependencies:** Task 2.4

**Description:**
Write tests for the cleanup cron endpoint before creating the file.

**File:** `tests/unit/api/cron/cleanup-extractions.test.ts`

**Test cases:**

- Calling the endpoint deletes rows where `expiresAt < now()`
- Rows where `expiresAt >= now()` are NOT deleted
- Requires `CRON_SECRET` authorization header; returns 401 without it

**Acceptance Criteria:**

- [ ] Test file exists, all cases → FAIL

---

### Task 5.3: ExtractionCache Cleanup — Implementation

**Status:** 🔴 Blocked by 5.2
**Effort:** 1 h
**Dependencies:** Task 5.2

**Description:**
Create `src/app/api/cron/cleanup-extractions/route.ts`. This Vercel Cron route deletes expired extraction cache rows. Protected by a `CRON_SECRET` authorization header check.

Also add the cron configuration to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-extractions",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Acceptance Criteria:**

- [ ] All tests from Task 5.2 pass
- [ ] `vercel.json` updated with cron schedule
- [ ] 401 returned for requests without valid `CRON_SECRET`

---

## Phase 6: Integration, E2E & Review

### Task 6.1: Integration Tests

**Status:** 🔴 Blocked by 2.2, 2.4, 5.1
**Effort:** 2 h
**Dependencies:** Tasks 2.2, 2.4, 5.1

**Description:**
Write integration tests that exercise the full router stack with a real database (test Postgres instance).

**Files:**

- `tests/integration/profile.test.ts`
- `tests/integration/resume.test.ts`

**`profile.test.ts` scenarios:**

- Create a seeker, call `updateProfile` with all fields → verify DB state
- `getMe` returns all fields; `parsedResume` absent; SeekerSettings absent
- `getById` returns public profile; `resumeUrl` absent
- Completeness score recalculated correctly across multiple `updateProfile` calls
- `setActiveStatus` toggle works; CONFLICT on duplicate state

**`resume.test.ts` scenarios:**

- `confirmUpload` sets `resumeUrl` and clears `parsedResume`
- `triggerExtraction` → `applyExtraction` round-trip (with mocked AI SDK)
- `applyExtraction` with expired cache → NOT_FOUND
- `applyExtraction` with wrong seeker → FORBIDDEN

**Acceptance Criteria:**

- [ ] Integration tests pass against test Postgres instance
- [ ] AI SDK mocked (no real API calls in integration tests)
- [ ] Tests run in isolation (each test cleans up its data)

---

### Task 6.2: E2E Tests

**Status:** 🔴 Blocked by 4.16, 6.1
**Effort:** 2 h
**Dependencies:** Tasks 4.16, 6.1

**Description:**
Write Playwright E2E tests for the two critical user flows.

**Files:**

- `tests/e2e/profile-setup.spec.ts`
- `tests/e2e/resume-upload.spec.ts`

**`profile-setup.spec.ts` flows:**

- Flow 1: New seeker navigates to `/profile/setup`, fills all required sections → completeness reaches ≥ 70 → "Agent activation available" message shown
- Flow 2: Completeness below 70 → agent activation blocked → incomplete sections listed

**`resume-upload.spec.ts` flows:**

- Flow 1: Upload PDF → extraction proposed → review → apply → profile updated
- Flow 2: Upload without BYOK key → "Configure API key" prompt shown
- Flow 3: Unsupported file type → error message, no upload initiated

**Acceptance Criteria:**

- [ ] All E2E flows pass in local dev environment
- [ ] Screenshots captured on failure (Playwright `screenshot: "only-on-failure"`)
- [ ] Tests do not rely on real AI API calls (use test mode / mock server)

---

### Task 6.3: Code Review

**Status:** 🔴 Blocked by 6.1, 6.2
**Effort:** 1 h
**Dependencies:** Tasks 6.1, 6.2

**Description:**
Run `/code-review` on all changed files in the feature branch. Address all CRITICAL and HIGH findings.

**Files to review:**

- `src/lib/profile-completeness.ts`
- `src/server/api/routers/jobSeekers.ts`
- `src/server/api/routers/resume.ts`
- `src/app/api/resume/upload/route.ts`
- `src/components/profile/*.tsx`
- `src/app/(seeker)/profile/setup/page.tsx`

**Acceptance Criteria:**

- [ ] Code review completed
- [ ] All CRITICAL and HIGH findings resolved
- [ ] No console.log statements in production code
- [ ] TypeScript strict mode passes (`pnpm lint`)
- [ ] Feature branch ready for PR

---

## Dependency Graph

```
0.1
 ├─ 1.1 ─ 1.2 ──┐
 └─ 1.3 ─ 1.4   │
                 ├─ 2.1 ─ 2.2 ──┐
                 └─ 2.3 ─ 2.4 ──┤
                                 ├─ 2.5
                                 │
                       2.2 ─ 3.1 ─ 3.2 ─┐
                                         │
                     2.5 + 3.2 ─ 4.1 ─ 4.2
                                         │
                   ┌─────────────────────┤
                   │    4.3 ─ 4.4        │
                   │    4.5 ─ 4.6        │
                   │    4.7 ─ 4.8        │
                   │    4.9 ─ 4.10       │
                   │    4.11 ─ 4.12      │
                   │    4.13 ─ 4.14      │
                   │                     │
                   └── 2.4+3.2 ─ 4.15 ─ 4.16
                                         │
               2.2+2.4+3.2 ─ 5.1        │
               2.4 ─ 5.2 ─ 5.3          │
                                         │
                        5.1 + 4.16 ─ 6.1 ─ 6.2 ─ 6.3
```

---

## Parallelization Opportunities

| Parallel Group          | Tasks                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Phase 1 utilities       | 1.1 / 1.3 (independent)                                     |
| Phase 1 implementations | 1.2 / 1.4 (independent)                                     |
| Phase 2 test writing    | 2.1 / 2.3 / 3.1 (all depend on 1.2 only)                    |
| Phase 4 section forms   | 4.3–4.14 (all depend on 4.2; all independent of each other) |

---

## User Story Coverage

| User Story                          | Tasks                                             |
| ----------------------------------- | ------------------------------------------------- |
| US-1: Create Initial Profile        | 4.1, 4.2, 4.3, 4.4, 6.2 (profile-setup flow)      |
| US-2: Upload Resume + AI Extraction | 2.3, 2.4, 3.1, 3.2, 4.15, 4.16, 6.2 (resume flow) |
| US-3: Completeness Score            | 1.1, 1.2, 4.1, 4.2                                |
| US-4: Work Experience               | 4.5, 4.6                                          |
| US-5: Skills                        | 1.3, 1.4, 4.9, 4.10                               |
| US-6: Portfolio URLs                | 4.11, 4.12                                        |
| US-7: Location & Relocation         | 4.13, 4.14                                        |
| US-8: Update Profile                | 2.1, 2.2 (`updateProfile`), all section forms     |
