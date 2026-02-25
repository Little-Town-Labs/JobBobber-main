# Technology Research — 3-job-seeker-profile

**Branch:** 3-job-seeker-profile
**Date:** 2026-02-24

---

## Decision 1: Resume File Upload Strategy

**Context:** Job seekers upload PDF/DOCX resumes (up to 10 MB). We need to store them durably
and make them available for AI extraction. The stack already includes Vercel Blob.

**Options Considered:**

### A. Direct Client Upload via Vercel Blob `@vercel/blob/client` `upload()`

- Browser calls `handleUpload` on a route handler to get a client token, then streams directly to Vercel Blob CDN
- File never passes through the Next.js server
- **Pros:** Minimal server load; handles large files gracefully; built-in progress events; Vercel Blob is already a dependency
- **Cons:** Slightly more complex setup (two-step: token → upload); requires a `/api/resume/upload` route handler for the token exchange
- **Appropriate for:** Files ≤ 500 MB

### B. Server-Side Proxied Upload via Route Handler

- Client POSTs file to `/api/resume/upload`; server streams it to Vercel Blob via `put()`
- **Pros:** Simpler client code; server can validate/scan before storage
- **Cons:** File passes through Vercel serverless function (256 MB limit on hobby; 1 GB on Pro); higher memory pressure; no client-side upload progress without custom streaming

**Chosen:** **A — Vercel Blob client upload**
**Rationale:** Vercel explicitly recommends client-side upload for large files to avoid serverless memory limits. The two-step token exchange is well-documented and standard. Our 10 MB limit is well within bounds. A thin `/api/resume/upload` route handler handles token generation and file-type validation (checks MIME before issuing a token).
**Tradeoffs:** Route handler required for token issuance; MIME type validation must also be enforced server-side (client-side check alone is insufficient).

---

## Decision 2: AI Resume Extraction Strategy

**Context:** After upload, the system should extract structured data (experience, education, skills,
headline) using the user's BYOK API key.

**Options Considered:**

### A. tRPC Mutation: `jobSeekers.extractResume`

- Client calls a tRPC mutation that reads the resume from Blob storage, calls the AI provider, and returns the extracted fields
- **Pros:** Consistent with existing tRPC architecture; full type-safety via Zod; standard error handling path; result immediately returned to client for review
- **Cons:** Vercel serverless function timeout (max 60s on Pro; 300s on Enterprise); large PDFs may approach this limit

### B. Inngest Background Workflow

- Client triggers an Inngest event; extraction runs as a background workflow; client polls or uses real-time updates for result
- **Pros:** No timeout concerns; durable execution; can retry on failure
- **Cons:** No immediate result for user review; requires polling or WebSocket/SSE for real-time feedback; significantly more complex UX; extraction of a single resume should complete well within 15s

**Chosen:** **A — tRPC mutation with reasonable timeout**
**Rationale:** Resume extraction for a single document should complete in 5–15 seconds with any major AI provider. The spec requires the extraction result to be presented for user review before saving — this interactive flow is best served by a direct mutation return, not a polling loop. Inngest adds complexity that is not justified for this use case. Vercel Pro timeout is 60 seconds; worst-case extraction for a 10-page PDF should remain under 30s.

**Mitigation for timeout risk:** Instruct the AI SDK to use streaming via `generateObject` with a 30-second timeout. If extraction fails (timeout, API error, bad key), the mutation returns a structured error that allows the UI to fall back gracefully (resume stored, user prompted to fill manually).

---

## Decision 3: AI Extraction — Provider SDK & Prompt Approach

**Context:** The user's BYOK key may be OpenAI or Anthropic. We need structured extraction.

**Options Considered:**

### A. Vercel AI SDK `generateObject()` with Zod schema

- `generateObject({ model, schema: zodSchema, prompt })` returns validated structured output
- Supports both OpenAI and Anthropic via unified interface
- Schema is Zod, validated automatically before return
- **Pros:** Provider-agnostic; output validated at type level; clean TypeScript types; exactly what the constitution requires
- **Cons:** Vercel AI SDK v3 required (already in the project)

### B. Direct OpenAI/Anthropic SDK with JSON mode

- Call SDK directly with `response_format: { type: "json_object" }` (OpenAI) or `tool_use` (Anthropic)
- **Pros:** More direct control
- **Cons:** Provider-specific; requires two code paths; manual JSON parsing + Zod validation step

**Chosen:** **A — Vercel AI SDK `generateObject()`**
**Rationale:** The constitution (Article IV) requires Vercel AI SDK. `generateObject()` provides provider-agnostic structured extraction with automatic Zod validation. The model instance is created at call time using the user's BYOK key via `createOpenAI()` or `createAnthropic()`.

---

## Decision 4: Multi-Step Profile Form — Navigation Strategy

**Context:** The profile form has 6 sections. The spec allows partial saves per section.

**Options Considered:**

### A. URL-based steps (`/profile/setup/[step]`)

- Each section is a separate route; step state is in the URL
- **Pros:** Browser back/forward works; deep-linkable; refresh-safe
- **Cons:** More pages/layouts; Next.js navigation cost between steps; each step needs its own page file

### B. Single page with client-side step state

- One `/profile/setup` page; a stepper component manages which section is shown
- State stored in React useState or URL search params (`?step=2`)
- **Pros:** Single layout; easy to validate across steps; shared state simpler to manage
- **Cons:** URL is not step-specific unless search params are used

### C. Tabbed layout (all sections always accessible)

- `/profile` page with tabs for each section (Basic, Experience, Skills, etc.)
- Not a wizard — user navigates freely between sections
- **Pros:** Non-linear editing; better for returning users editing a specific section; aligns with "sections independently saveable" requirement
- **Cons:** No guided first-time wizard flow; could feel overwhelming for new users

**Chosen:** **C — Tabbed layout (primary), with initial guided sequence for first-time users**
**Rationale:** The spec requires sections to be independently saveable and editable after initial creation (User Story 8). A tabbed layout satisfies this naturally. For first-time creation (profile completeness = 0), the UI can highlight the "start here" section and guide the user through, but the tabs remain accessible. This avoids the complexity of two separate flows (wizard for creation, non-wizard for editing).

**Implementation note:** Tab state managed via URL search params (`?tab=experience`) so the active tab is shareable and refresh-safe.

---

## Decision 5: Profile Completeness Score — Calculation Strategy

**Context:** Completeness score (0–100%) must be stored and recalculated on every profile update.

**Options Considered:**

### A. Server-side calculation in tRPC mutation, stored in DB

- Score calculated in `updateProfile` mutation and persisted to `profileCompleteness` field
- **Pros:** Single source of truth; score stored means it can be queried efficiently; no recalculation on read
- **Cons:** Must be recalculated on every write; slight complexity in mutation

### B. Computed on every read (virtual field)

- `getMe` calculates the score from the current field values and returns it; never persisted
- **Pros:** Always accurate; no stale value risk
- **Cons:** Calculation cost on every read; cannot query by score without persisting

**Chosen:** **A — Server-side, stored**
**Rationale:** The `profileCompleteness` field already exists in the Prisma schema. The agent activation gate (FR-5) requires querying or checking the score. Storing it enables efficient queries. The recalculation is simple arithmetic and adds negligible overhead to write operations.

**Scoring weights:**
| Field | Points |
|-------|--------|
| name | 10 |
| headline | 10 |
| bio | 10 |
| ≥ 1 experience entry | 20 |
| ≥ 1 education entry | 10 |
| ≥ 3 skills | 20 |
| resumeUrl | 10 |
| location | 5 |
| ≥ 1 URL | 5 |
| **Total** | **100** |

---

## Decision 6: Skills Autocomplete — Data Source

**Context:** The spec requires skill suggestions from a curated list; free-text allowed.

**Options Considered:**

### A. Static curated list in a server-side TypeScript file

- A `src/lib/skills-list.ts` file exports a sorted array of ~500 common technical and professional skills
- **Pros:** Zero latency; no database query; trivial to maintain; tree-shaken from client bundles (server import)
- **Cons:** Cannot be updated without a deployment; limited to pre-defined skills

### B. Database-backed skills table

- `Skills` table; API query for autocomplete suggestions
- **Pros:** Admin-editable without deployment
- **Cons:** Adds a database table and query; unnecessary for MVP; over-engineered

**Chosen:** **A — Static list**
**Rationale:** MVP does not require admin-managed skills. A static list of ~500 curated skills (covering software engineering, design, marketing, finance, management, etc.) is sufficient. Free-text input allows skills outside the list. The list can be promoted to a DB table in a later phase if needed. Aligns with constitution Article IV (YAGNI).

---

## Decision 7: Extracted Resume Parsing

**Context:** Resumes are uploaded as PDF or DOCX. The AI needs to read the text content.

**Options Considered:**

### A. Send the raw file bytes to the AI as a multipart attachment

- OpenAI and Anthropic both support file attachments in their APIs

### B. Extract text server-side before sending to AI

- Use a PDF parsing library (e.g., `pdf-parse`) to extract plain text; send text to AI
- **Pros:** Cheaper (text is smaller than file); no file attachment API dependency; works with both OpenAI and Anthropic via unified text prompt
- **Cons:** Requires a server-side PDF parsing dependency; DOCX parsing also needed

### C. Use Vercel AI SDK with file attachments

- Pass the file URL directly; AI provider fetches it
- **Pros:** Minimal code; works for OpenAI assistants API
- **Cons:** Requires file to be publicly accessible (not the case for private Blob storage)

**Chosen:** **B — Server-side text extraction**
**Rationale:** Text extraction before AI call works for both providers, avoids file attachment API differences, and is cheaper per token. `pdf-parse` for PDFs; `mammoth` for DOCX (both lightweight, well-maintained). Text is then included in the `generateObject` prompt. The resume file is in private Blob storage (signed URL), so Option C would require additional presigned URL handling.

**Libraries:**

- `pdf-parse` (PDF text extraction)
- `mammoth` (DOCX → plain text)

---

## Summary of Key Choices

| Concern             | Decision                                       |
| ------------------- | ---------------------------------------------- |
| Resume storage      | Vercel Blob client upload (direct)             |
| AI extraction call  | tRPC mutation with `generateObject()`          |
| AI SDK              | Vercel AI SDK (provider-agnostic)              |
| Resume text parsing | `pdf-parse` + `mammoth` server-side            |
| Multi-step form     | Tabbed layout with URL search param step       |
| Completeness score  | Server-side calculation, stored in DB          |
| Skills data source  | Static curated list (`src/lib/skills-list.ts`) |
