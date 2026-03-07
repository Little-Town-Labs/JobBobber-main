# Technology Research — 2-authentication-byok

**Branch**: `2-authentication-byok`
**Created**: 2026-02-23

---

## Decision 1: Middleware Gate for BYOK Key Detection

**Context**: The middleware needs to determine whether a user has configured a BYOK key without making a database query (middleware runs at the Vercel edge, where full Prisma/NeonDB queries are not available without the Neon serverless driver and added latency).

**Options Considered**:

### Option A: Clerk User Metadata (Chosen)

Store `hasByokKey: boolean` in Clerk user `publicMetadata` alongside the `role` field. This is already available in `auth().sessionClaims` at the middleware layer — zero additional network calls.

**Pros:**

- Zero latency in middleware (read from JWT claims)
- Consistent with existing `role` field storage pattern
- Updated atomically when key is stored or deleted via `clerkClient.users.updateUserMetadata()`
- Works at Vercel edge without DB access

**Cons:**

- Clerk metadata is authoritative; a DB inconsistency could theoretically leave them out of sync (mitigated: BYOK store/delete always updates both DB and Clerk metadata atomically in a server transaction)

### Option B: NeonDB Serverless Driver in Middleware

Query the database directly from middleware using `@neondatabase/serverless` (HTTP-based driver that works at edge).

**Pros:**

- Always authoritative — no sync risk

**Cons:**

- 50–150ms added latency on every protected request
- Adds edge-incompatible dependencies to middleware bundle
- Unnecessarily expensive for a boolean flag check

### Option C: HTTP-Only Cookie

Set a `byok_configured=1` cookie server-side after BYOK key is stored.

**Pros:**

- Zero latency

**Cons:**

- Cookies can be tampered with client-side (though only affects UX gating, not actual API security)
- Requires careful cookie path and expiry management
- Less elegant than existing Clerk metadata pattern

**Decision: Option A — Clerk User Metadata**

Rationale: Perfectly consistent with how `role` is already stored and read. No additional latency. The tRPC procedures still enforce actual security independently (middleware gate is a UX convenience; API authorization is the real security layer).

---

## Decision 2: Employer BYOK Key Storage Location

**Context**: The Prisma schema stores BYOK keys on `SeekerSettings` (per job seeker) and `JobSettings` (per job posting). But the onboarding BYOK flow applies to employers at the account level — before any job postings exist.

**Options Considered**:

### Option A: Add `byokApiKeyEncrypted` to `Employer` model (Chosen)

Add `byokApiKeyEncrypted String?` and `byokProvider String?` directly to the `Employer` model. This represents the employer's "account-level" default BYOK key, used for all their agent operations unless overridden at the job posting level.

**Pros:**

- Matches the job seeker pattern (`SeekerSettings.byokApiKeyEncrypted`)
- Available before any job postings exist (required for onboarding)
- Clean data model: employer-level key vs. job-posting-level key override
- Feature 4 can default `JobSettings.byokApiKeyEncrypted` to the employer-level key

**Cons:**

- Requires a schema migration (additive change — safe)

### Option B: Create `EmployerSettings` model (parallel to `SeekerSettings`)

A dedicated private settings table for employers.

**Pros:**

- Better symmetry with `SeekerSettings`
- Could store future private employer settings (billing, notification prefs)

**Cons:**

- Over-engineered for MVP — the only field needed now is the BYOK key
- Feature 8 (private negotiation parameters) doesn't add employer-level private fields — those are per-job-posting in `JobSettings`
- Adds a migration and a new model for one field

### Option C: Defer employer BYOK to Feature 4 (job posting creation)

Don't require a BYOK key during employer onboarding. Require it only when creating the first job posting.

**Pros:**

- No schema change needed now

**Cons:**

- Violates the spec's hard gate requirement: "all dashboard routes blocked until BYOK key is set"
- Creates a confusing UX: employer can see the dashboard but can't do anything useful

**Decision: Option A — add fields to Employer model**

Rationale: Minimal additive migration, cleanest UX, enables the hard gate pattern, consistent with the seeker BYOK model. Future features can override at the job-posting level.

---

## Decision 3: API Key Validation Method

**Context**: The spec requires validating a submitted API key against the provider via a "live, minimal API call" before storing it. This must be cheap, fast, and not consume meaningful tokens.

**Options Considered**:

### Option A: List Models Endpoint (Chosen)

Both OpenAI (`GET https://api.openai.com/v1/models`) and Anthropic (`GET https://api.anthropic.com/v1/models`) offer a models list endpoint that requires a valid API key and returns immediately with no token usage.

**Pros:**

- Zero token cost on both providers
- Fast (typically < 500ms)
- Validates that the key exists and has at minimum read access

**Cons:**

- A key that can list models but has no completion credits would still pass (extremely rare edge case)

### Option B: Minimal Chat Completion

Send a 1-token completion request to verify the key can actually make inference calls.

**Pros:**

- More thorough validation (proves inference access)

**Cons:**

- Costs money (even minimal) on every onboarding attempt
- Slower than model listing
- Anthropic's minimum token billing is still non-zero

**Decision: Option A — List Models Endpoint**

Rationale: No cost, sufficient for key validity confirmation. The spec says "validates the key against the provider" — listing models satisfies this. A key that passes this check will almost certainly work for chat completions.

**Provider Validation Endpoints**:

- OpenAI: `GET https://api.openai.com/v1/models` with `Authorization: Bearer {key}`
- Anthropic: `GET https://api.anthropic.com/v1/models` with `x-api-key: {key}` and `anthropic-version: 2023-06-01`

---

## Decision 4: Clerk Organization Creation Timing

**Context**: When an employer registers, a Clerk Organization must be created with their company name. This must happen server-side (Clerk Backend SDK). The question is whether to create it in the `setRole` tRPC mutation or via a Clerk webhook.

**Options Considered**:

### Option A: Create in `setRole` Mutation (Chosen)

The `setRole` tRPC mutation (server-side, via `protectedProcedure`) calls `clerkClient.organizations.createOrganization()` directly and gets back the `orgId` to store in the `Employer` DB record.

**Pros:**

- Synchronous: the org exists before the mutation returns
- Simple: single code path, easy to test and roll back
- The user's orgId is immediately available for subsequent calls

**Cons:**

- If the DB write fails after Clerk org creation, we have an orphaned Clerk org (mitigated: wrap in try/catch and delete the org if DB write fails)

### Option B: Via Clerk Webhook

Use Clerk's `organizationMembership.created` or `user.created` webhook to trigger org creation asynchronously.

**Pros:**

- Webhooks are already set up (Feature 1)

**Cons:**

- Async: the org may not exist when the mutation returns, breaking the redirect flow
- Much more complex error handling
- Role selection and org creation become decoupled, creating race conditions

**Decision: Option A — create org in setRole mutation**

Rationale: Synchronous creation is the only way to guarantee the org exists before the user is redirected to the next step. Orphaned org cleanup is handled with a try/catch that calls Clerk's delete org API if the subsequent DB write fails.

---

## Decision 5: Role Selection UX Pattern

**Context**: (Resolved in clarification session.) Post-Clerk redirect pattern was chosen: user completes Clerk sign-up, then lands on `/onboarding/role`. The key implementation question is whether this page uses a React Server Component (RSC) form or a Client Component with tRPC.

**Decision: Client Component with tRPC mutation**

Rationale: The `setRole` mutation calls Clerk Backend SDK and makes DB writes — not suitable for a Server Action due to the Clerk SDK dependency. Using tRPC keeps it consistent with the rest of the API layer and ensures proper error handling with typed error codes.

---

## Key Dependency: Clerk Backend SDK

The `@clerk/backend` package provides server-side API access:

- `clerkClient.users.updateUserMetadata(userId, { publicMetadata: { role, hasByokKey } })`
- `clerkClient.organizations.createOrganization({ name, createdBy })`
- Already available transitively via `@clerk/nextjs` — no new dependency needed

---

## Constitutional Compliance Summary

| Principle                | Status | Notes                                                   |
| ------------------------ | ------ | ------------------------------------------------------- |
| I. Type Safety           | ✅     | All inputs via Zod; outputs typed end-to-end            |
| II. TDD                  | ✅     | Tests written first for all new procedures              |
| III. BYOK                | ✅     | Core feature of this spec; uses existing AES-256 module |
| IV. Minimal Abstractions | ✅     | Clerk SDK + tRPC directly; no additional auth libraries |
| V. Security & Privacy    | ✅     | Key never returned in API responses; log guards added   |
| VI. Feature Flags        | ✅     | No feature flag needed — BYOK is P0/unconditional       |
| VII. Agent Autonomy      | N/A    | No agents in this feature                               |
