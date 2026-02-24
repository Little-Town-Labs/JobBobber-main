# Implementation Plan — 2-authentication-byok

**Branch**: `2-authentication-byok`
**Specification**: `.specify/specs/2-authentication-byok/spec.md`
**Created**: 2026-02-23

---

## Executive Summary

Feature 2 adds the two mandatory onboarding steps that every new user must complete before accessing JobBobber's AI features: **role selection** (Job Seeker or Employer) and **BYOK API key setup**. Both are enforced by Next.js middleware gates. The feature integrates deeply with Clerk (for identity and organization management) and reuses the AES-256-GCM encryption module from Feature 1. No new external service dependencies are introduced.

---

## Architecture Overview

```
Browser                Next.js Middleware              tRPC Server            Clerk API          DB
  │                         │                              │                      │               │
  │── GET /dashboard ───────▶                              │                      │               │
  │                    [check sessionClaims]               │                      │               │
  │                    role == null?                       │                      │               │
  │◀── 302 /onboarding/role ─│                             │                      │               │
  │                          │                             │                      │               │
  │── POST onboarding.setRole ──────────────────────────▶  │                      │               │
  │                          │                        write role                  │               │
  │                          │                             │──── createOrg ───────▶               │
  │                          │                             │                      │               │
  │                          │                             │──────────────────────────────────▶  │
  │                          │                             │              create Employer row      │
  │◀── { success, redirect } ◀──────────────────────────── │                      │               │
  │                          │                             │                      │               │
  │── GET /setup/api-key ────▶                             │                      │               │
  │                    [check hasByokKey]                  │                      │               │
  │                          │                             │                      │               │
  │── POST byok.storeKey ───────────────────────────────▶  │                      │               │
  │                          │                         validate key ─────────────────────────▶   │
  │                          │                             │                      │               │
  │                          │                         encrypt + store ──────────────────────▶  DB│
  │                          │                         update hasByokKey ─────────▶              │
  │◀── { success } ◀────────────────────────────────────── │                      │               │
  │── GET /seeker/dashboard or /employer/dashboard          │                      │               │
```

---

## Technology Stack

All decisions pre-constrained by the project constitution. No deviations.

| Concern            | Technology                         | Rationale                                          |
| ------------------ | ---------------------------------- | -------------------------------------------------- |
| Authentication     | Clerk (existing)                   | Pre-chosen; handles OAuth, sessions, orgs          |
| Role/BYOK metadata | Clerk `publicMetadata`             | Available in middleware JWT; zero latency          |
| API layer          | tRPC v11 (existing)                | Type-safe, consistent with existing infrastructure |
| Encryption         | `src/lib/encryption.ts` (existing) | AES-256-GCM, user-scoped IV — already built        |
| Database           | Prisma 5 + NeonDB (existing)       | Additive migration only                            |
| UI                 | Next.js 15 App Router + shadcn/ui  | Pre-chosen; onboarding pages are client components |
| Key validation     | Fetch to provider models API       | Zero cost, fast, sufficient for key presence check |
| Org creation       | Clerk Backend SDK                  | Synchronous, ensures org exists before redirect    |

---

## Technical Decisions

### TD-1: Middleware BYOK Gate via Clerk Metadata

See `research.md` Decision 1. Clerk `publicMetadata.hasByokKey` is read from JWT claims in middleware — zero DB queries on every request.

### TD-2: Employer BYOK Key on `Employer` Model

See `research.md` Decision 2. Two new nullable columns added to `employers` table: `byok_api_key_encrypted` and `byok_provider`. Enables the onboarding hard gate for employers before any job postings exist.

### TD-3: Key Validation via Models List Endpoint

See `research.md` Decision 3. Both OpenAI and Anthropic expose `GET /v1/models` requiring a valid API key, with zero token cost. Used for all key validation calls.

### TD-4: Synchronous Clerk Org Creation in setRole Mutation

See `research.md` Decision 4. The `setRole` mutation creates the Clerk Organization synchronously so the `clerkOrgId` is available immediately for the `Employer` DB record. Orphaned org cleanup on DB write failure.

---

## Implementation Phases

### Phase 1: Schema & Env (prerequisite)

**Goal**: Get the database and environment ready before writing any application code.

#### 1.1 — Extend Prisma Schema

Add to `Employer` model in `prisma/schema.prisma`:

```prisma
byokApiKeyEncrypted String?    // AES-256-GCM ciphertext (base64)
byokProvider        String?    // "openai" | "anthropic"
byokKeyValidatedAt  DateTime?  // timestamp of last successful validation
byokMaskedKey       String?    // last 4 chars: "sk-...xxxx" — non-sensitive display value
```

Add to `SeekerSettings` model in `prisma/schema.prisma`:

```prisma
byokMaskedKey       String?    // last 4 chars: "sk-...xxxx" — non-sensitive display value
```

(Note: `SeekerSettings` already has `byokApiKeyEncrypted` and `byokProvider` from Feature 1.)

Storing `byokMaskedKey` separately avoids AES-256-GCM decryption on every `getKeyStatus` read. The `storeKey` mutation populates it; `deleteKey` nulls it.

#### 1.2 — Run Migration

```bash
pnpm db:migrate --name add_employer_byok_fields
```

Generates and applies SQL:

```sql
ALTER TABLE employers
  ADD COLUMN byok_api_key_encrypted TEXT,
  ADD COLUMN byok_provider TEXT,
  ADD COLUMN byok_key_validated_at TIMESTAMP(3),
  ADD COLUMN byok_masked_key TEXT;

ALTER TABLE seeker_settings
  ADD COLUMN byok_masked_key TEXT;
```

#### 1.3 — Environment Variables (already exist from Feature 1)

Confirm these are set in `.env.local`:

- `ENCRYPTION_KEY` — 64 hex chars
- `ENCRYPTION_IV_SALT` — any string
- `CLERK_SECRET_KEY` — Clerk backend key (used by Clerk Backend SDK)

No new env vars needed for this feature.

---

### Phase 2: Middleware Gates

**Goal**: Enforce the two sequential onboarding gates at the edge.

#### 2.1 — Update `src/middleware.ts`

The current middleware only enforces Clerk authentication. Extend it to:

1. Add `/onboarding/role` and `/setup/api-key` to public (accessible without completing that step):

   ```
   Public routes (no auth): /, /sign-in, /sign-up, /api/trpc, /api/inngest, /api/webhooks
   Semi-public (auth required, but role/byok not required): /onboarding/role, /setup/api-key
   Protected (all three): everything else
   ```

2. After `auth.protect()`:
   - Read `sessionClaims.metadata.role` → if null and not on `/onboarding/role` → redirect to `/onboarding/role`
   - Read `sessionClaims.metadata.hasByokKey` → if false/null and not on `/setup/api-key` or `/onboarding/role` → redirect to `/setup/api-key`
   - Guard against re-entry: if user already has role and visits `/onboarding/role`, redirect to `/setup/api-key`; if user has both and visits `/setup/api-key`, redirect to their dashboard.

**Test**: Unit tests mock `auth()` session claims and verify redirect behavior for all state combinations.

---

### Phase 3: tRPC Routers

**Goal**: Server-side logic for role assignment and BYOK key lifecycle.

#### 3.0 — Add `onboardingProcedure` to `src/server/api/trpc.ts`

**Critical finding from contract review**: The existing `protectedProcedure` requires BOTH `ctx.userId` AND `ctx.userRole` to be non-null. But `onboarding.setRole` is called to CREATE the role — it cannot be gated by a middleware that requires the role to already exist.

Add a new procedure tier that requires only `userId`:

```typescript
// In src/server/api/trpc.ts
const enforceSession = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
export const onboardingProcedure = t.procedure.use(enforceSession)
```

Updated hierarchy:

```
publicProcedure
  └─ onboardingProcedure   → userId required; userRole may be null
        └─ protectedProcedure → userId + userRole required
              ├─ seekerProcedure
              └─ employerProcedure
                    └─ adminProcedure
```

`onboardingProcedure` is used exclusively by `onboardingRouter.setRole` and `byokRouter.storeKey`.

#### 3.1 — `onboardingRouter` (`src/server/api/routers/onboarding.ts`)

**`setRole` mutation:**

```
Input:  { role: 'JOB_SEEKER' | 'EMPLOYER', companyName?: string }
Auth:   onboardingProcedure (userId required; userRole may be null — see Phase 3.0)
```

Logic (pseudocode):

```
1. Validate input with Zod (companyName required if role === 'EMPLOYER')
2. Idempotency check: if ctx.userRole already set, return { success: true } early
3. Fetch Clerk user to get display name (for JobSeeker.name)
4. If role === 'JOB_SEEKER':
   a. clerkClient.users.updateUserMetadata(userId, { publicMetadata: { role: 'JOB_SEEKER' } })
   b. db.jobSeeker.create({ clerkUserId, name, skills: [], urls: [] })
   c. db.seekerSettings.create({ seekerId: seeker.id })
5. If role === 'EMPLOYER':
   a. const org = clerkClient.organizations.createOrganization({ name: companyName, createdBy: userId })
   b. [if org creation fails → throw INTERNAL_SERVER_ERROR]
   c. clerkClient.users.updateUserMetadata(userId, { publicMetadata: { role: 'EMPLOYER' } })
   d. [if metadata update fails → delete org + throw]
   e. const employer = db.employer.create({ clerkOrgId: org.id, name: companyName })
   f. [if employer create fails → delete org + throw]
   g. db.employerMember.create({ employerId: employer.id, clerkUserId, role: 'ADMIN' })
6. Return { success: true }
```

**Error codes:**

- `BAD_REQUEST` — companyName missing for EMPLOYER, or role invalid
- `INTERNAL_SERVER_ERROR` — Clerk API failure or DB failure

#### 3.2 — `byokRouter` (`src/server/api/routers/byok.ts`)

**`storeKey` mutation:**

```
Input:  { provider: 'openai' | 'anthropic', apiKey: string (min 20, max 256) }
Auth:   protectedProcedure
```

Logic:

```
1. Validate apiKey format: OpenAI starts with 'sk-', Anthropic starts with 'sk-ant-'
2. Call provider validation endpoint (GET /v1/models with key in header)
   - Timeout: 10 seconds
   - If HTTP 4xx → throw BAD_REQUEST('Invalid API key — not recognized by provider')
   - If HTTP 5xx or timeout → throw SERVICE_UNAVAILABLE('Provider validation failed — try again')
3. const encrypted = await encrypt(apiKey, ctx.userId)  [from src/lib/encryption.ts]
4. If ctx.userRole === 'JOB_SEEKER':
   - db.seekerSettings.upsert({ seekerId: seeker.id }, { byokApiKeyEncrypted: encrypted, byokProvider: provider })
5. If ctx.userRole === 'EMPLOYER':
   - db.employer.update({ clerkOrgId: ctx.orgId }, { byokApiKeyEncrypted: encrypted, byokProvider: provider, byokKeyValidatedAt: now() })
6. await clerkClient.users.updateUserMetadata(ctx.userId, { publicMetadata: { hasByokKey: true } })
7. const maskedKey = `${provider === 'openai' ? 'sk' : 'sk-ant'}-...${apiKey.slice(-4)}`
8. Return { success: true, provider, maskedKey }
   ⚠️  NEVER include apiKey or encrypted in the return value
```

**`deleteKey` mutation:**

```
Input:  none
Auth:   protectedProcedure
```

Logic:

```
1. If ctx.userRole === 'JOB_SEEKER':
   - db.seekerSettings.update({ byokApiKeyEncrypted: null, byokProvider: null })
2. If ctx.userRole === 'EMPLOYER':
   - db.employer.update({ byokApiKeyEncrypted: null, byokProvider: null, byokKeyValidatedAt: null })
3. clerkClient.users.updateUserMetadata(userId, { publicMetadata: { hasByokKey: false } })
4. Return { success: true }
```

**`getKeyStatus` query:**

```
Input:  none
Auth:   protectedProcedure
Returns: { hasKey: boolean, provider: 'openai' | 'anthropic' | null, maskedKey: string | null }
⚠️  NEVER return byokApiKeyEncrypted or any decrypted value
```

#### 3.3 — Add routers to `src/server/api/root.ts`

```typescript
import { onboardingRouter } from "./routers/onboarding"
import { byokRouter } from "./routers/byok"

export const appRouter = createTRPCRouter({
  // ... existing routers ...
  onboarding: onboardingRouter,
  byok: byokRouter,
})
```

---

### Phase 4: UI Pages

**Goal**: User-facing onboarding screens.

#### 4.1 — Onboarding Shell Layout (`src/app/(onboarding)/layout.tsx`)

Full-page centered layout with no sidebar/nav. Used by both `/onboarding/role` and `/setup/api-key`. Simple: centered card, JobBobber logo, progress indicator (Step 1 of 2 / Step 2 of 2).

#### 4.2 — Role Selection Page (`src/app/(onboarding)/onboarding/role/page.tsx`)

- Server Component: reads Clerk session to redirect if role already set
- Client Component `RoleSelectionForm`:
  - Two shadcn/ui `Card` components: "I'm looking for work" / "I'm hiring"
  - When "I'm hiring" selected: `Input` for company name slides in with animation
  - Submit via `trpc.onboarding.setRole.useMutation()`
  - Loading spinner on submit
  - Error toast if mutation fails

#### 4.3 — BYOK Setup Page (`src/app/(onboarding)/setup/api-key/page.tsx`)

- Server Component: reads session to redirect if `hasByokKey === true`
- Client Component `ByokSetupForm`:
  - Provider selector: `RadioGroup` with OpenAI / Anthropic options
  - Cost estimate: `Alert` component showing "$2–$8/month typical usage"
  - Key format hint: text below input updates based on provider selection
  - `Input` with `type="password"` for API key
  - "Submit" → `trpc.byok.storeKey.useMutation()` → loading state → success redirect
  - Error state: `Alert` with destructive variant for validation failures

#### 4.4 — API Key Settings Page (`src/app/(protected)/account/api-key/page.tsx`)

- Shows current key status (provider + masked key)
- "Replace Key" → inline key input form (same form as 4.3, reused component)
- "Delete Key" → shadcn `AlertDialog` confirmation → `trpc.byok.deleteKey.useMutation()`

---

### Phase 5: Security Hardening

#### 5.1 — Log Guards

Ensure `byokApiKeyEncrypted` never appears in logs or tracing spans. Add to the tRPC error formatter: strip any field named `byokApiKeyEncrypted` or `apiKey` from error `data`.

#### 5.2 — Input Sanitization

The `apiKey` Zod schema:

```typescript
z.string()
  .min(20, "API key too short")
  .max(256, "API key too long")
  .refine(
    (key) => key.startsWith("sk-"),
    "API key must start with sk- (OpenAI or Anthropic format)",
  )
  .transform((key) => key.trim()) // strip accidental whitespace
```

#### 5.3 — Provider Validation Timeout

Wrap provider fetch in `AbortController` with 10-second timeout. Handle `AbortError` → `SERVICE_UNAVAILABLE`.

#### 5.4 — Accessibility (WCAG 2.1 AA)

All onboarding forms must meet WCAG 2.1 AA requirements (spec NFR):

- All `Input`, `RadioGroup`, `Card` interactive elements have visible focus rings (shadcn/ui defaults provide these; verify Tailwind config doesn't override `outline: none` globally)
- Form labels associated with inputs via `htmlFor`/`id` or shadcn's `Label` component
- Error `Alert` components use `role="alert"` for screen reader announcement (shadcn `Alert` does not do this by default — add `aria-live="polite"` or `role="alert"` to the destructive variant wrapper)
- Keyboard: entire role selection flow completable without mouse (card selection via `Space`/`Enter`, tab order logical)
- Color contrast: Tailwind defaults meet 4.5:1 for text; verify any custom status badge colors

#### 5.5 — Atomic Clerk+DB Updates

For `setRole` (EMPLOYER path): if DB write fails after Clerk org creation, call `clerkClient.organizations.deleteOrganization(org.id)` to clean up the orphaned org.

---

## Security Considerations

| Threat                           | Mitigation                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| API key logged server-side       | Never log `apiKey` input; strip from error payloads                                                                      |
| API key returned in API response | `getKeyStatus` returns only masked form; all DB queries never select `byokApiKeyEncrypted` in return values              |
| BYOK key stored in plain text    | AES-256-GCM encryption via `src/lib/encryption.ts` with user-scoped IV                                                   |
| Client-side key access           | `byokApiKeyEncrypted` never selected in tRPC queries returning to client                                                 |
| Forged role metadata             | Role written server-side by `setRole` mutation — not client-settable; tRPC procedures independently verify from session  |
| Onboarding bypass                | Middleware + tRPC procedure guards are independent — middleware is UX convenience; tRPC is the true security gate        |
| Adversarial API key submission   | Zod validation rejects non-`sk-` prefixed strings; live provider call rejects invalid keys; 10s timeout prevents hanging |
| SSRF via provider URL            | URLs are hardcoded constants, not user-provided — no SSRF vector                                                         |

---

## Performance Strategy

- **Middleware**: Zero DB queries — all checks via Clerk JWT claims (< 1ms overhead)
- **`setRole`**: ~2 round trips (Clerk metadata write + DB write). Acceptable for a one-time operation.
- **`storeKey`**: Provider validation is the bottleneck (~200–500ms). UI shows loading state throughout.
- **`getKeyStatus`**: DB query selects only `byokProvider` (not the encrypted key) — fast single-column read.

---

## Testing Strategy

### Unit Tests (Vitest)

All tests use mocked Clerk and mocked external fetch.

| Test Suite                              | Coverage Target                                                        |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `onboarding.setRole` — JOB_SEEKER path  | Role written, JobSeeker created, SeekerSettings created                |
| `onboarding.setRole` — EMPLOYER path    | Org created, Employer created, EmployerMember ADMIN created            |
| `onboarding.setRole` — idempotency      | Returns early if role already set                                      |
| `onboarding.setRole` — orphan cleanup   | DB failure deletes Clerk org                                           |
| `byok.storeKey` — valid OpenAI key      | Encrypted + stored + Clerk updated                                     |
| `byok.storeKey` — valid Anthropic key   | Encrypted + stored + Clerk updated                                     |
| `byok.storeKey` — invalid key (4xx)     | BAD_REQUEST thrown, nothing stored                                     |
| `byok.storeKey` — provider timeout      | SERVICE_UNAVAILABLE thrown, nothing stored                             |
| `byok.storeKey` — key never in response | Assert response has no `apiKey` or `encrypted` fields                  |
| `byok.deleteKey` — seeker path          | byokApiKeyEncrypted = null, Clerk hasByokKey = false                   |
| `byok.deleteKey` — employer path        | same                                                                   |
| `byok.getKeyStatus` — key set           | hasKey=true, provider set, maskedKey set                               |
| `byok.getKeyStatus` — no key            | hasKey=false, provider=null                                            |
| Middleware                              | All gate combinations (no role, role+no byok, both) redirect correctly |

### Integration Tests (Vitest + real DB)

- `setRole` creates correct DB records with correct foreign keys
- `storeKey` + `getKeyStatus` round-trip (does not return raw key)
- `deleteKey` + `getKeyStatus` shows hasKey=false

### E2E Tests (Playwright)

- Full job seeker onboarding flow (sign-up → role select → BYOK setup → dashboard)
- Full employer onboarding flow (sign-up → role select + company name → BYOK setup → dashboard)
- BYOK key replacement flow (settings page → replace key → success)
- BYOK key deletion flow (settings page → delete → dashboard redirected to /setup/api-key)
- Role enforcement: job seeker can't access employer routes (get 403/redirect)

---

## Deployment Strategy

1. Deploy schema migration first (additive — no downtime)
2. Deploy application code (middleware + new routers + new pages)
3. No feature flags required — this is a P0 unconditional feature
4. Monitor: Clerk webhook logs, tRPC error rates on `storeKey`, Vercel function logs for any key material leakage (automated log scan)

---

## Risks & Mitigation

| Risk                                                | Likelihood | Impact | Mitigation                                                                                                                                                                                            |
| --------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk org creation fails mid-transaction            | Low        | Medium | Orphan cleanup with try/catch; surface error to user                                                                                                                                                  |
| Provider models endpoint returns unexpected shape   | Medium     | Low    | Treat any 2xx as success; treat 4xx as invalid key; treat 5xx/timeout as retry                                                                                                                        |
| `hasByokKey` Clerk metadata out of sync with DB     | Very Low   | Medium | Self-healing: `/setup/api-key` page calls `byok.getKeyStatus` on load; if DB has key but `hasByokKey` is false in JWT claims, the page re-syncs Clerk metadata and redirects — no admin action needed |
| Anthropic models endpoint has different auth header | Low        | Medium | Verify before implementing; test against Anthropic sandbox                                                                                                                                            |

---

## Constitutional Compliance

- [x] **I. Type Safety**: All inputs via Zod; all returns typed; Prisma types propagated to tRPC
- [x] **II. TDD**: Tests written before implementation; all acceptance criteria have corresponding test cases
- [x] **III. BYOK**: This feature IS the BYOK setup flow; reuses existing AES-256 encryption module
- [x] **IV. Minimal Abstractions**: Clerk SDK + tRPC + direct fetch for validation; no extra auth libraries
- [x] **V. Security & Privacy**: Key never returned; log guards; encryption at rest; Middleware + tRPC double-enforcement
- [x] **VI. Feature Flags**: Not needed — BYOK is P0 unconditional; no beta flag
- [x] **VII. Agent Autonomy**: Not applicable to this feature
