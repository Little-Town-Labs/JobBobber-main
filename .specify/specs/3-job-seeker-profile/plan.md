# Implementation Plan — 3-job-seeker-profile

**Branch:** 3-job-seeker-profile
**Date:** 2026-02-24
**Spec:** .specify/specs/3-job-seeker-profile/spec.md
**Data Model:** .specify/specs/3-job-seeker-profile/data-model.md
**Contracts:** .specify/specs/3-job-seeker-profile/contracts/trpc-contracts.ts

---

## Executive Summary

Feature 3 delivers the job seeker profile creation and management experience for JobBobber. The feature covers a tabbed profile editor with six sections (Basic Info, Experience, Education, Skills, URLs, Location), resume upload with AI-assisted field extraction using the user's BYOK API key, and a profile completeness score that gates agent activation.

The implementation requires:

- One Prisma migration (add `profileUrls Json[]` to `job_seekers`)
- One new tRPC router (`resumeRouter`)
- One new Next.js Route Handler (`/api/resume/upload`)
- Expanding the existing `jobSeekersRouter` stub
- A shared utility (`profile-completeness.ts`)
- A static skills data module (`skills-data.ts`)
- A tabbed profile page with six section forms

No new infrastructure dependencies. All AI calls use the Vercel AI SDK already in the project.

---

## Architecture Overview

```
Browser
  │
  ├─ /profile/setup?tab=basic  (tabbed profile editor)
  │      │
  │      ├─ BasicInfoForm → tRPC: jobSeekers.updateProfile
  │      ├─ ExperienceForm → tRPC: jobSeekers.updateProfile
  │      ├─ EducationForm → tRPC: jobSeekers.updateProfile
  │      ├─ SkillsForm → tRPC: jobSeekers.updateProfile
  │      ├─ UrlsForm → tRPC: jobSeekers.updateProfile
  │      └─ LocationForm → tRPC: jobSeekers.updateProfile
  │
  ├─ Resume upload flow
  │      │
  │      ├─ 1. POST /api/resume/upload (Route Handler — Vercel Blob token exchange)
  │      │       └─ Clerk auth + JobSeeker row check → return clientToken
  │      │
  │      ├─ 2. Browser PUT directly to Vercel Blob CDN (using clientToken)
  │      │
  │      ├─ 3. tRPC: resume.confirmUpload(blobUrl) → persist resumeUrl
  │      │
  │      ├─ 4. tRPC: resume.triggerExtraction(blobUrl)
  │      │       ├─ Fetch file from Blob (server-side signed URL)
  │      │       ├─ pdf-parse / mammoth → plain text
  │      │       ├─ Decrypt BYOK key from SeekerSettings
  │      │       ├─ generateObject(schema, text) via Vercel AI SDK
  │      │       └─ Cache extraction result (15-min TTL) → return extractionId
  │      │
  │      └─ 5. tRPC: resume.applyExtraction(extractionId, applyFlags)
  │               └─ Commit approved sections to JobSeeker row
  │
  └─ tRPC: jobSeekers.getMe() — loads all profile data for page
```

### Key Boundaries

- **Route Handler** (`/api/resume/upload`): handles only the Vercel Blob token handshake. Does NOT persist any DB state. Auth enforced via Clerk `auth()` in `onBeforeGenerateToken`.
- **resumeRouter**: handles upload confirmation, AI extraction, and extraction commit. All four procedures use `seekerProcedure`.
- **jobSeekersRouter**: handles profile reads and updates. `getById` is `publicProcedure` (never joins SeekerSettings).
- **profile-completeness.ts**: shared utility, imported by both routers. Pure function, no DB dependencies.

---

## Technology Stack

All choices are mandated by the project constitution and Feature 1/2 foundation.

| Concern          | Choice                            | Rationale                                      |
| ---------------- | --------------------------------- | ---------------------------------------------- |
| Type safety      | tRPC 11 + Zod                     | Constitution Article I; already in project     |
| Database ORM     | Prisma + `@prisma/client`         | Constitution; Feature 1                        |
| AI extraction    | Vercel AI SDK `generateObject()`  | Constitution Article IV; provider-agnostic     |
| Resume storage   | Vercel Blob                       | Feature 1 dependency                           |
| File parsing     | `pdf-parse` + `mammoth`           | Server-side text extraction; provider-agnostic |
| Extraction cache | `ExtractionCache` Prisma model    | See decision below                             |
| Skills list      | Static TypeScript module          | Zero latency; YAGNI                            |
| Multi-step form  | `react-hook-form` + tabbed layout | Matches existing form patterns                 |
| Tab navigation   | URL search params (`?tab=basic`)  | Shareable, refresh-safe                        |
| Testing          | Vitest + Playwright               | Constitution Article II; Feature 1             |

---

## Technical Decisions

### Decision 1: Resume Upload — Route Handler vs. Direct Vercel Blob

**Chosen:** Next.js Route Handler (`/api/resume/upload`) for the token exchange.

The Vercel Blob client SDK's `handleUpload()` requires direct access to the raw `Request` body to manage its client-token protocol. tRPC's superjson body parser consumes the stream before `handleUpload()` can access it. The route handler is the only viable approach.

The upload flow is intentionally split:

1. Route handler issues the client token (auth enforced via Clerk `auth()`)
2. Browser uploads file directly to Vercel Blob CDN (no server memory pressure)
3. Client calls `resume.confirmUpload` via tRPC to persist the resulting URL

The route handler does **not** write to the database in its `onUploadCompleted` callback. The tRPC `confirmUpload` step handles persistence within the `seekerProcedure` auth chain.

**Security note:** The route handler validates the MIME type (only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) before issuing a token. Server-side MIME validation is the authoritative check; the client-side check is UX only.

---

### Decision 2: Extraction Cache — PostgreSQL Model

**Chosen:** Add an `ExtractionCache` Prisma model with a `expiresAt DateTime` field.

**Options considered:**

- **PostgreSQL `ExtractionCache` model**: One migration, no new infrastructure, queryable for ownership checks, cleaned up by a Prisma cron job or on-demand.
- **Vercel KV**: Requires a new billable dependency (not in Feature 1). YAGNI.
- **`JobSeeker.parsedResume` field**: Reuses an existing column, but conflates "raw cached extraction" with "confirmed parsed data". The two have different semantics and TTLs.

**Chosen:** PostgreSQL model. The project already uses Prisma/PostgreSQL; adding a table is simpler than adding a new service. The TTL is enforced by comparing `expiresAt` to `Date.now()` on read and by a periodic cleanup query in a Vercel cron route.

```prisma
model ExtractionCache {
  id         String   @id @default(cuid())
  seekerId   String
  proposed   Json     // ResumeExtractionResult.proposed shape
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  seeker     JobSeeker @relation(fields: [seekerId], references: [id], onDelete: Cascade)

  @@index([seekerId])
  @@index([expiresAt])
  @@map("extraction_cache")
}
```

---

### Decision 3: Resume Blob Access Mode

**Chosen:** `access: "public"` with URL treated as a secret.

Vercel Blob's `"private"` access mode (signed URLs) requires generating a new signed URL every time the file is fetched for AI extraction. The URL expires; the signed URL generation adds latency.

For MVP, the resume URL is stored as `resumeUrl` on the JobSeeker row and is **never returned in `PublicJobSeekerProfile`** (the `getById` public response). It is only returned in `FullJobSeekerProfile` (accessible only to the owning job seeker via `seekerProcedure`).

The AI extraction step fetches the file server-side from the blob URL stored in the database — no client-visible URL is ever exposed to the public.

This simplifies the implementation at acceptable MVP-level security. A future feature can migrate to private access + signed URLs without changing the API contracts.

---

### Decision 4: `profileUrls` Migration

**Chosen:** Add `profileUrls Json[] @default([])` to `JobSeeker` via migration.

The existing `urls String[]` field stores plain URL strings. User Story 6 requires labelled URLs (`{ id, label, url }`). Storing structured objects in `String[]` is not viable. The cleanest solution is a new `profileUrls Json[]` field with the `ProfileUrl` sub-schema, deprecating (but not dropping) `urls`.

The `UpdateProfileInputSchema.urls` field in the contracts file maps to the new `profileUrls` column. Implementers must ensure the tRPC input field name and Prisma column are clearly mapped in the router code.

---

### Decision 5: Skills Autocomplete Data Source

**Chosen:** Static TypeScript module at `src/lib/skills-data.ts`.

Approximately 500 curated skills covering software engineering, product, design, marketing, and operations. The module exports a sorted `string[]`. The autocomplete component filters client-side. Free-text entry allows skills outside the list. The list can be promoted to a database table in a later phase without changing the API contract.

---

## Implementation Phases

### Phase 0: Database Migration

**Files:**

- `prisma/migrations/TIMESTAMP_add-profile-urls-and-extraction-cache/migration.sql`
- `prisma/schema.prisma` (two additions)

**Changes:**

1. Add `profileUrls Json[] @default([])` to `JobSeeker`
2. Add `ExtractionCache` model (see schema above)
3. Add `extractionCache ExtractionCache[]` relation on `JobSeeker`

**Order constraint:** All other phases depend on this migration.

---

### Phase 1: Shared Utilities

**Files:**

- `src/lib/profile-completeness.ts`
- `src/lib/skills-data.ts`

**`profile-completeness.ts`:**

```typescript
// Scoring weights (total 100):
// name: 15, headline: 15, bio: 10, experience ≥ 1: 20,
// skills ≥ 3: 15, education ≥ 1: 10, location: 5, resumeUrl: 10
export function computeProfileCompleteness(seeker: ProfileCompletenessInput): number
```

Imported by `jobSeekersRouter` and `resumeRouter`. Pure function — no DB access.

**`skills-data.ts`:**

```typescript
export const SKILLS: string[] = [
  /* ~500 sorted skill strings */
]
```

---

### Phase 2: tRPC Routers

**Files:**

- `src/server/api/routers/jobSeekers.ts` (expand existing stub)
- `src/server/api/routers/resume.ts` (new file)
- `src/server/api/root.ts` (add `resume: resumeRouter`)

**`jobSeekers.ts` — expand existing stub:**

| Procedure         | Change                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `getMe`           | Implement: query `ctx.seeker`, parse JSON fields, return `FullJobSeekerProfile`                                  |
| `getById`         | Implement: `db.jobSeeker.findUnique`, explicit field select (no SeekerSettings), return `PublicJobSeekerProfile` |
| `updateProfile`   | Implement: partial update, array full-replace, call `computeProfileCompleteness`, persist score                  |
| `setActiveStatus` | New: single-field toggle, throw CONFLICT on no-op                                                                |

**`resume.ts` — new router:**

| Procedure           | Implementation summary                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `getUploadUrl`      | Validate MIME + size, call `handleUpload()`, return `{ uploadUrl, blobPath, expiresAt }`                                     |
| `confirmUpload`     | Validate `blobUrl` hostname, set `resumeUrl`, clear `parsedResume`, recompute completeness                                   |
| `triggerExtraction` | Check BYOK key → fetch file → parse text → decrypt key → `generateObject()` → cache result → return `ResumeExtractionResult` |
| `applyExtraction`   | Fetch cache by ID, verify ownership, apply approved sections, recompute completeness, delete cache entry                     |

---

### Phase 3: Route Handler

**File:** `src/app/api/resume/upload/route.ts`

```typescript
export async function POST(request: Request): Promise<Response>
```

Uses `handleUpload()` from `@vercel/blob/client`. The `onBeforeGenerateToken` callback calls `auth()` from `@clerk/nextjs/server` and queries `db.jobSeeker.findUnique` to confirm the authenticated user is a registered job seeker. Only then is the client token issued.

The `onUploadCompleted` callback does nothing (URL persistence is handled by `resume.confirmUpload` via tRPC).

---

### Phase 4: Frontend — Profile Page

**Route:** `/profile/setup` (within `(seeker)` layout group)

**Files:**

```
src/app/(seeker)/profile/
  setup/
    page.tsx                    ← tabbed container, loads getMe
    loading.tsx
    error.tsx

src/components/profile/
  profile-tabs.tsx              ← tab navigation (URL search params)
  completeness-card.tsx         ← score + missing sections display
  basic-info-form.tsx           ← name, headline, bio
  experience-form.tsx           ← add/edit/remove experience entries
  education-form.tsx            ← add/edit/remove education entries
  skills-form.tsx               ← autocomplete tag input
  urls-form.tsx                 ← labelled URL entries
  location-form.tsx             ← location + relocation preference
  resume-upload-card.tsx        ← upload + extraction status display
  resume-extraction-review.tsx  ← review extracted fields before applying
```

**State ownership:**

- Each section form owns its local react-hook-form state
- The page (`setup/page.tsx`) owns the tRPC query (`getMe`) and all mutations
- Mutations are passed down as props; forms call them on submit
- URL search param `?tab=basic` controls active tab (default: `basic`)
- Extraction state (pending / reviewing / applied) is local React state in `resume-upload-card.tsx`

**Tab order (guided, all accessible):**

1. Basic Info (default)
2. Experience
3. Education
4. Skills
5. URLs
6. Location

**Completeness card:** displayed above tabs on all views. Shows numeric score, progress bar, and a checklist of incomplete sections with deep links.

---

### Phase 5: Security & Hardening

1. MIME type validation in route handler (server-authoritative)
2. `blobUrl` hostname validation in `resume.confirmUpload` against `BLOB_STORE_HOSTNAME`
3. `blobUrl` ownership validation in `resume.triggerExtraction` (must match `ctx.seeker.resumeUrl`)
4. Extraction cache ownership check in `resume.applyExtraction`
5. No raw resume content in logs; no decrypted BYOK key in logs or responses
6. AI provider error sanitised before returning `errorReason`
7. ExtractionCache cleanup cron: `src/app/api/cron/cleanup-extractions/route.ts`

---

### Phase 6: Tests

**Unit tests:**

- `src/lib/profile-completeness.test.ts` — all scoring combinations; boundary at 70
- `src/lib/skills-data.test.ts` — list is sorted, no duplicates, length ≥ 100
- `src/server/api/routers/jobSeekers.test.ts` — all four procedures; access control; completeness recalculation
- `src/server/api/routers/resume.test.ts` — all four procedures; BYOK absent; timeout; extraction cache TTL
- `src/components/profile/*.test.tsx` — form validation, save flow, error states

**Integration tests:**

- `tests/integration/profile.test.ts` — full profile update flow with in-memory DB
- `tests/integration/resume.test.ts` — upload → confirm → extract → apply with mocked AI SDK

**E2E tests:**

- `tests/e2e/profile-setup.spec.ts` — complete profile creation to 70% threshold
- `tests/e2e/resume-upload.spec.ts` — upload, extraction review, apply flow

---

## Security Considerations

### OWASP Top 10 Relevant to This Feature

| Risk                              | Mitigation                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A01 Broken Access Control**     | `seekerProcedure` middleware enforces ownership on all writes. `getById` explicitly omits SeekerSettings via Prisma `select`. |
| **A03 Injection**                 | All inputs validated by Zod before DB writes. Prisma parameterises all queries.                                               |
| **A05 Security Misconfiguration** | Resume blob URL validated against `BLOB_STORE_HOSTNAME` env var to prevent open-redirect. MIME type validated server-side.    |
| **A07 Auth Failures**             | Route handler enforces Clerk auth in `onBeforeGenerateToken`. Token is not issued to unauthenticated requests.                |
| **A09 Logging Failures**          | Resume text and decrypted BYOK keys must never appear in logs. AI provider errors sanitised before client response.           |

### Privacy Boundary

The `PublicJobSeekerProfile` type (returned by `getById`) omits `resumeUrl` and `parsedResume`. The tRPC procedure must use an explicit Prisma `select` that excludes these fields — no `*` selects on the `JobSeeker` model in public procedures.

---

## Performance Targets

From the spec NFRs:

| Operation                  | Target           | Strategy                                                            |
| -------------------------- | ---------------- | ------------------------------------------------------------------- |
| Profile page load          | < 1 s            | `getMe` server-prefetched in page component (tRPC server-side call) |
| Resume upload              | < 10 s for 10 MB | Direct browser → Vercel Blob CDN (no server proxying)               |
| AI extraction              | < 15 s           | 30-second `AbortController` timeout on AI call; loading state shown |
| Profile save (per section) | < 300 ms p90     | Single-row Prisma update; no joins on write path                    |

---

## Testing Strategy

**TDD workflow:** Tests written first (RED), minimal implementation to pass (GREEN), refactor (IMPROVE).

**Coverage requirement:** 80%+ across all new files.

**Test isolation:**

- Unit tests for utilities use no Prisma (`profile-completeness.ts` is a pure function)
- Router tests use a mock Prisma client (no live DB required)
- Integration tests use a test PostgreSQL instance (already configured in Feature 1)
- E2E tests use the full Next.js dev server

**AI SDK mocking:** `resume.triggerExtraction` tests mock the Vercel AI SDK `generateObject()` to return deterministic extraction results. Timeout behaviour is tested via `vi.useFakeTimers()`.

---

## Deployment Notes

- The DB migration runs automatically via `prisma migrate deploy` in CI before the app starts.
- `pdf-parse` and `mammoth` are Node.js packages — they run only in the tRPC router (server-side). They must not be imported by any client component.
- The `ExtractionCache` cleanup cron should be configured as a Vercel Cron Job (`vercel.json` or `app/api/cron` route with `schedule`). Run once per hour. Deletes rows where `expiresAt < now()`.
- No new environment variables required (see data-model.md §Environment Variables).

---

## Risks & Mitigation

| Risk                                     | Likelihood | Impact | Mitigation                                                                                |
| ---------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| AI extraction times out for long resumes | Medium     | Medium | AbortController at 30 s; graceful fallback: resume stored, user prompted to fill manually |
| `pdf-parse` fails on malformed PDF       | Low        | Low    | Wrap in try/catch; return `success: false` with friendly error                            |
| Vercel Blob cold path latency            | Low        | Low    | File fetched server-side for extraction; no user-facing latency added                     |
| lint-staged hooks fail on new files      | Low        | Low    | Run `pnpm lint` locally before committing; add new patterns to `.eslintrc` if needed      |

---

## Constitutional Compliance

- [x] **Type Safety (I):** All inputs validated with Zod. AI extraction output validated against `ExtractionResultSchema` before caching.
- [x] **TDD (II):** Tests written first; 80%+ coverage required. All 6 phases have corresponding test files.
- [x] **BYOK (III):** BYOK key decrypted server-side only. Never returned in any response. If absent, extraction returns structured error.
- [x] **Minimal Abstractions (IV):** Direct Vercel AI SDK call. No additional extraction framework. Static skills list (no DB query). YAGNI applied throughout.
- [x] **Security & Privacy (V):** `PublicJobSeekerProfile` never includes `resumeUrl` or SeekerSettings fields. Extraction cache scoped by ownership.
- [x] **Feature Flags (VI):** `SEEKER_PROFILE` controls profile creation UI (frontend navigation). `PRIVATE_PARAMS` gates private settings UI (deferred to Feature 8). tRPC procedures do not enforce these flags — flag enforcement is at the layout/navigation layer per constitution.
- [x] **Agent Autonomy (VII):** `profileCompleteness` score ≥ 70 required for agent activation. Score recalculated and persisted on every write.

---

## Open Questions Resolved

| Question                          | Resolution                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Extraction cache storage          | PostgreSQL `ExtractionCache` model (see Decision 2)                                                  |
| Vercel Blob access mode           | `access: "public"` with URL treated as secret; `resumeUrl` never in public response (see Decision 3) |
| Labelled URLs migration           | Add `profileUrls Json[]` via migration; deprecate `urls String[]` (see Decision 4, data-model.md)    |
| Upload via tRPC or Route Handler? | Route Handler for token exchange (tRPC body parsing is incompatible with Vercel Blob handshake)      |
