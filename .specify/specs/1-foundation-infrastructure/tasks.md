# Task Breakdown: 1-foundation-infrastructure

**Feature Branch**: `1-foundation-infrastructure`
**Date**: 2026-02-23
**Plan**: `.specify/specs/1-foundation-infrastructure/plan.md`
**Status**: Ready for Implementation

---

## Summary

| Metric           | Value                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Total Tasks      | 41                                                                                                                                     |
| Phases           | 6                                                                                                                                      |
| Quality Gates    | 5                                                                                                                                      |
| Estimated Effort | ~48 hours                                                                                                                              |
| Critical Path    | T1.1 → T1.3 → T1.4T → T1.4I → T2.1 → T2.2 → T2.3T → T2.3I → T3.1T → T3.1I → T3.2I → T4.1 → T4.2T → T4.2I → T5.1T → T5.1I → T6.1 → T6.2 |

### Task Legend

- 🟡 **Ready** — no blocking dependencies
- 🔴 **Blocked** — waiting on another task
- **T** suffix — test task (write tests first; must FAIL before proceeding)
- **I** suffix — implementation task (blocked by corresponding T task)

### TDD Enforcement

Every non-trivial file has a corresponding test task (`T`) that must be completed and
confirmed FAILING before its implementation task (`I`) begins. This is enforced by the
dependency chain in this file.

---

## Phase 1: Project Scaffold

**Goal**: A compilable, linted, tested, CI-gated Next.js 15 project with no business logic.

---

### T1.1 — Initialize Next.js 15 project

**Status**: 🟡 Ready
**Effort**: 1h
**Depends on**: —
**Parallel with**: —

**Description**:
Create the Next.js 15 App Router project with TypeScript 5 strict mode, configure `tsconfig.json`
for `noUncheckedIndexedAccess`, set up `pnpm` workspace, configure path aliases.

**Acceptance Criteria**:

- [ ] `pnpm create next-app` executed with `--typescript --app --src-dir`
- [ ] `tsconfig.json`: `"strict": true, "noUncheckedIndexedAccess": true, "noImplicitAny": true`
- [ ] `pnpm dev` starts without TypeScript errors
- [ ] `pnpm build` produces a clean build
- [ ] `src/` directory structure matches `plan.md` directory tree
- [ ] Root `layout.tsx` and `page.tsx` placeholder in place

---

### T1.2T — Environment validation tests

**Status**: 🔴 Blocked by T1.1
**Effort**: 0.5h
**Depends on**: T1.1
**Parallel with**: —

**Description**:
Write tests for `src/lib/env.ts` **before** implementing it. Tests must FAIL before proceeding.

**Test File**: `tests/unit/lib/env.test.ts`

**Test Cases**:

- [ ] Missing required variable (`DATABASE_URL`) throws at module initialization
- [ ] Valid environment config passes validation without error
- [ ] `NEXT_PUBLIC_` variables exposed; server-only variables not accessible from client bundle
- [ ] `NODE_ENV=test` fixture available for test suite

**Confirm tests FAIL** before proceeding to T1.2I.

---

### T1.2I — Implement environment validation (`src/lib/env.ts`)

**Status**: 🔴 Blocked by T1.2T
**Effort**: 0.5h
**Depends on**: T1.2T

**Description**:
Implement `src/lib/env.ts` using `@t3-oss/env-nextjs` with Zod schemas for all variables
documented in `data-model.md` → Environment Variables section.

```bash
pnpm add @t3-oss/env-nextjs zod
```

**Acceptance Criteria**:

- [ ] All tests from T1.2T pass
- [ ] Server-only variables: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`,
      `CLERK_WEBHOOK_SECRET`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `ENCRYPTION_KEY`,
      `ENCRYPTION_IV_SALT`, `SENTRY_DSN`
- [ ] Client variables: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, all `NEXT_PUBLIC_CLERK_*_URL`
- [ ] `.env.example` committed documenting every variable with description comment
- [ ] `pnpm build` fails if any required variable is absent

---

### T1.3 — Linting, formatting, and pre-commit hooks

**Status**: 🔴 Blocked by T1.1
**Effort**: 1h
**Depends on**: T1.1
**Parallel with**: T1.2T, T1.2I

**Description**:
Configure ESLint with TypeScript strict rules, Prettier, Husky pre-commit hook.

```bash
pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D prettier eslint-config-prettier
pnpm add -D husky lint-staged
npx husky install
```

**Acceptance Criteria**:

- [ ] `.eslintrc.json` enables `@typescript-eslint/strict` ruleset
- [ ] `"no-restricted-syntax"` rule prohibits `as any` (allows `as unknown` for legitimate casts)
- [ ] `.prettierrc` configured (single quotes, no semicolons, 100 char line width — or team choice)
- [ ] `lint-staged` config: `.ts/.tsx` → Prettier + ESLint; `.prisma` → Prisma format
- [ ] Pre-commit hook prevents commits with unformatted files (`pnpm lint-staged`)
- [ ] `pnpm lint` and `pnpm format:check` scripts in `package.json`
- [ ] All existing files pass lint and format checks

---

### T1.4T — Test infrastructure tests (meta)

**Status**: 🔴 Blocked by T1.2I, T1.3
**Effort**: 0.5h
**Depends on**: T1.2I, T1.3
**Parallel with**: —

**Description**:
Write a trivial passing test to confirm Vitest is configured correctly.
This is the test that verifies the test runner itself works.

**Test File**: `tests/unit/lib/env.test.ts` (already written in T1.2T — extend it here)

**Additional test**: `tests/unit/sanity.test.ts`

```typescript
import { expect, it } from "vitest"
it("test infrastructure is working", () => {
  expect(1 + 1).toBe(2)
})
```

**Confirm test FAILS if coverage threshold is set** — this drives T1.4I.

---

### T1.4I — Configure Vitest + Playwright + coverage gate

**Status**: 🔴 Blocked by T1.4T
**Effort**: 1h
**Depends on**: T1.4T

**Description**:
Configure the complete test infrastructure with coverage enforcement.

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react
pnpm add -D @playwright/test @playwright/test
pnpm add -D @testing-library/react @testing-library/user-event
```

**Acceptance Criteria**:

- [ ] `vitest.config.ts` created with:
  - `coverage.provider: "v8"`
  - `coverage.thresholds: { global: { lines: 80, functions: 80, branches: 80 } }`
  - `coverage.exclude` list for: `prisma/**`, `*.config.*`, `src/app/api/**` (Next.js routes)
- [ ] `playwright.config.ts` created targeting `http://localhost:3000`
- [ ] `package.json` scripts: `test`, `test:watch`, `test:coverage`, `test:e2e`
- [ ] `pnpm test:coverage` passes with current files (sanity test covers the base)
- [ ] Coverage gate enforced: modifying threshold to 99% breaks the run

---

### T1.5 — GitHub Actions CI pipeline

**Status**: 🔴 Blocked by T1.4I
**Effort**: 1h
**Depends on**: T1.4I

**Description**:
Write `.github/workflows/ci.yml` with four required jobs.

**Acceptance Criteria**:

- [ ] Job 1 `typecheck`: `pnpm tsc --noEmit` — fails on type error
- [ ] Job 2 `lint`: `pnpm lint && pnpm format:check` — fails on lint/format error
- [ ] Job 3 `test`: `pnpm test:coverage` — fails if coverage < 80% or any test fails
- [ ] Job 4 `build`: `pnpm build` — fails on build error (needs env vars as CI secrets)
- [ ] All 4 jobs run in parallel except `build` (depends on `typecheck`)
- [ ] Branch protection requires all 4 status checks to pass before merge
- [ ] `NODE_VERSION: '20'` pinned; `pnpm` version pinned via `corepack`
- [ ] CI uses `DATABASE_URL` secret pointing at NeonDB test branch

**Quality Gate ✓** — CI pipeline is operational. Phase 1 complete.

---

## Phase 2: Database Layer

**Goal**: Complete Prisma schema migrated to NeonDB, seed data working, Prisma client available.

---

### T2.1 — Prisma setup and schema

**Status**: 🔴 Blocked by T1.4I
**Effort**: 1.5h
**Depends on**: T1.4I
**Parallel with**: T1.5

**Description**:
Install Prisma, copy the complete schema from `data-model.md`, configure datasource.

```bash
pnpm add prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

**Acceptance Criteria**:

- [ ] `prisma/schema.prisma` contains complete schema from `data-model.md`
- [ ] All 9 models present: `JobSeeker`, `SeekerSettings`, `Employer`, `EmployerMember`,
      `JobPosting`, `JobSettings`, `AgentConversation`, `Match`, `FeedbackInsights`
- [ ] All enums present (10 enums)
- [ ] `pgvector` extension declared: `previewFeatures = ["postgresqlExtensions"]` + `extensions = [pgvector(...)]`
- [ ] `postinstall` script: `"prisma generate"`
- [ ] `prisma format` produces no changes (schema is well-formatted)

---

### T2.2 — Apply initial migration

**Status**: 🔴 Blocked by T2.1
**Effort**: 0.5h
**Depends on**: T2.1

**Description**:
Run the first migration against the NeonDB development database (uses unpooled URL).

```bash
DATABASE_URL=$DATABASE_URL_UNPOOLED npx prisma migrate dev --name init
```

**Acceptance Criteria**:

- [ ] `prisma/migrations/[timestamp]_init/migration.sql` committed
- [ ] Migration creates all 9 tables, all 10 enums, all indexes
- [ ] `CREATE EXTENSION IF NOT EXISTS vector` present in migration SQL
- [ ] `npx prisma migrate status` shows 1 migration applied, 0 pending
- [ ] NeonDB dashboard confirms all tables exist

---

### T2.3T — Prisma client singleton tests

**Status**: 🔴 Blocked by T2.2
**Effort**: 0.5h
**Depends on**: T2.2

**Description**:
Write integration test for the Prisma client singleton **before** implementing it.

**Test File**: `tests/integration/db.test.ts`

**Test Cases**:

- [ ] Can connect to test database (non-production URL required)
- [ ] Can create a `JobSeeker` row with minimal required fields
- [ ] Can read the created row by `id`
- [ ] Can delete the row; confirm it no longer exists
- [ ] Test refuses to run if `DATABASE_URL` does not contain `test` or `localhost`
      (production guard)

**Confirm tests FAIL** (Prisma client not yet written) before proceeding to T2.3I.

---

### T2.3I — Implement Prisma client singleton (`src/server/db.ts`)

**Status**: 🔴 Blocked by T2.3T
**Effort**: 0.5h
**Depends on**: T2.3T

**Description**:
Implement the global Prisma client singleton with `import "server-only"`.

**Acceptance Criteria**:

- [ ] All tests from T2.3T pass
- [ ] `import "server-only"` at top of file (prevents client bundle inclusion)
- [ ] Global singleton pattern: `globalThis.__prisma` prevents multiple instances in hot-reload
- [ ] Uses `DATABASE_URL` (pooled) from `env.ts`
- [ ] `log: ['error']` in production; `log: ['query', 'error']` in development
- [ ] Exported as `export const db: PrismaClient`

---

### T2.4 — Seed data implementation

**Status**: 🔴 Blocked by T2.3I
**Effort**: 2h
**Depends on**: T2.3I

**Description**:
Implement `prisma/seed.ts` per the seed design in `data-model.md`.

**Entity counts** (from data-model.md):
5 JobSeekers, 5 SeekerSettings, 3 Employers, 6 EmployerMembers, 6 JobPostings,
6 JobSettings, 4 AgentConversations, 3 Matches, 4 FeedbackInsights

**Acceptance Criteria**:

- [ ] `process.env.NODE_ENV !== 'production'` guard at top — throws if run in prod
- [ ] Uses `upsert` (not `create`) for idempotent re-runs
- [ ] Clerk placeholder IDs: `user_seed_01..05`, `org_seed_01..03`
- [ ] Varied data: different experience levels, employment types, location types
- [ ] `pnpm db:seed` script runs without error
- [ ] `pnpm db:reset` script resets and re-seeds successfully
- [ ] After seeding: `prisma studio` (or psql count) confirms correct row counts

---

## Phase 3: tRPC Layer

**Goal**: Complete tRPC scaffold — all 7 routers with stub procedures, context hierarchy, client.

---

### T3.1T — tRPC context and middleware tests

**Status**: 🔴 Blocked by T2.3I
**Effort**: 1h
**Depends on**: T2.3I
**Parallel with**: T2.4

**Description**:
Write tests for `src/server/api/trpc.ts` — context creation and middleware chain —
**before** implementing the file.

**Test File**: `tests/unit/server/api/trpc.test.ts`

**Test Cases**:

- [ ] `createTRPCContext` with unauthenticated request: `userId` is `null`
- [ ] `createTRPCContext` with authenticated request: `userId` is the Clerk user ID
- [ ] `protectedProcedure` rejects unauthenticated call with `UNAUTHORIZED`
- [ ] `seekerProcedure` rejects caller with no `JobSeeker` record with `NOT_FOUND`
- [ ] `employerProcedure` rejects caller with no org ID with `FORBIDDEN`
- [ ] `adminProcedure` rejects caller with `org:member` role with `FORBIDDEN`

**Mocking**: Use `vi.mock('@clerk/nextjs/server', ...)` to stub `auth()`.

**Confirm tests FAIL** before proceeding to T3.1I.

---

### T3.1I — Implement tRPC core (`src/server/api/trpc.ts`)

**Status**: 🔴 Blocked by T3.1T
**Effort**: 1.5h
**Depends on**: T3.1T

```bash
pnpm add @trpc/server @tanstack/react-query
```

**Acceptance Criteria**:

- [ ] All tests from T3.1T pass
- [ ] `createTRPCContext` calls `auth()` from `@clerk/nextjs/server` and attaches `db`, `inngest`
- [ ] Five procedure builders exported: `publicProcedure`, `protectedProcedure`,
      `seekerProcedure`, `employerProcedure`, `adminProcedure`
- [ ] Each middleware level adds the correct context fields per `contracts/trpc-api.ts`
- [ ] `protectedProcedure` middleware: throws `UNAUTHORIZED` if `userId` is null
- [ ] `seekerProcedure` middleware: resolves `JobSeeker` from DB by `clerkUserId`; throws
      `NOT_FOUND` if absent (seeker hasn't completed onboarding yet)
- [ ] `employerProcedure` middleware: resolves `Employer` from DB by `clerkOrgId`; throws
      `FORBIDDEN` if absent
- [ ] `adminProcedure` middleware: verifies `orgRole === 'org:admin'`; throws `FORBIDDEN` otherwise
- [ ] Error formatter strips sensitive fields (no stack trace in production response body)

---

### T3.2T — Health router tests

**Status**: 🔴 Blocked by T3.1I
**Effort**: 0.5h
**Depends on**: T3.1I

**Description**:
Write tests for the health router before implementing it.

**Test File**: `tests/unit/server/api/routers/health.test.ts`

**Test Cases** (aligned with `contracts/trpc-api.ts` HealthPingOutput / HealthDeepCheckOutput):

- [ ] `health.ping` returns `{ status: "ok", timestamp: string }` — unauthenticated call succeeds
- [ ] `health.deepCheck` returns `{ healthy: true, checks: [...], timestamp: string }`
- [ ] `health.deepCheck` returns `healthy: false` and `status: "unreachable"` on the `"database"`
      check when DB connection fails (mock `db.$queryRaw` to throw)

**Confirm tests FAIL** before T3.2I.

---

### T3.2I — Implement all 7 router stubs

**Status**: 🔴 Blocked by T3.2T
**Effort**: 2.5h
**Depends on**: T3.2T

```bash
pnpm add @trpc/client @trpc/react-query @trpc/next
```

**Description**:
Implement all 7 routers as type-correct stubs. Business logic is added in later features.
Each procedure must match the contract in `contracts/trpc-api.ts`.

**Health router** (`src/server/api/routers/health.ts`)
(procedure names from `contracts/trpc-api.ts` — use `ping` and `deepCheck`, NOT `status`):

- [ ] `ping`: returns `{ status: "ok", timestamp: new Date().toISOString() }`
- [ ] `deepCheck`: queries `db.$queryRaw\`SELECT 1\``to test DB connectivity; returns`HealthDeepCheckOutput`shape with`healthy`, `checks`, `timestamp`

**All remaining routers** (jobSeekers, employers, jobPostings, matches, settings, insights):

- [ ] Each procedure accepts the correct Zod input schema from `contracts/trpc-api.ts`
- [ ] Each procedure returns a stub of the correct output type (empty array for lists,
      `null` for single-item gets that haven't been implemented yet)
- [ ] Every stub has `// TODO: implement in Feature N` comment (N from `contracts/trpc-api.ts`)
- [ ] `settings.getSeekerSettings` has **no `id` input** — identity from `ctx.seeker.id` only
- [ ] `insights.getMyInsights` checks `FEEDBACK_INSIGHTS` feature flag; throws `NOT_FOUND`
      if flag is OFF

**Root router** (`src/server/api/root.ts`):

- [ ] `appRouter` assembled from all 7 sub-routers
- [ ] `AppRouter` type exported for use in client
- [ ] `createCaller` exported for RSC usage

**HTTP handler** (`src/app/api/trpc/[trpc]/route.ts`):

- [ ] `fetchRequestHandler` configured with `appRouter` and `createTRPCContext`
- [ ] `GET` and `POST` methods exported

**tRPC client** (`src/lib/trpc/client.tsx`, `src/lib/trpc/server.ts`, `src/lib/trpc/query-client.ts`):

- [ ] `createTRPCReact<AppRouter>()` client exported
- [ ] `createCaller()` for RSC data fetching exported
- [ ] TanStack Query client configured with `staleTime: 5 * 60 * 1000`

---

### T3.3 — tRPC E2E smoke test

**Status**: 🔴 Blocked by T3.2I
**Effort**: 0.5h
**Depends on**: T3.2I

**Description**:
Write and run a Playwright test that hits `/api/trpc/health.ping` on the running dev server.

**Test File**: `tests/e2e/health.spec.ts`

**Acceptance Criteria**:

- [ ] `GET /api/trpc/health.ping` returns HTTP 200
- [ ] Response body matches `{ result: { data: { status: "ok", timestamp: "..." } } }`
- [ ] Test runs in CI (`pnpm test:e2e`) with server started by `pnpm dev`

**Quality Gate ✓** — tRPC is reachable end-to-end. Phase 3 complete.

---

## Phase 4: Clerk + Inngest Integration

**Goal**: Clerk middleware protects routes; webhook handler scaffolded; Inngest registered.

---

### T4.1 — Clerk middleware

**Status**: 🔴 Blocked by T3.2I
**Effort**: 0.5h
**Depends on**: T3.2I
**Parallel with**: T4.2T

```bash
pnpm add @clerk/nextjs
```

**Description**:
Write `src/middleware.ts` using `clerkMiddleware()` with public route configuration.

**Acceptance Criteria**:

- [ ] Public routes configured (no auth required):
      `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/trpc(.*)`, `/api/inngest(.*)`, `/api/webhooks/(.*)`
- [ ] All other routes protected (redirect to sign-in if unauthenticated)
- [ ] Auth pages configured in `src/app/(auth)/sign-in/` and `src/app/(auth)/sign-up/`
- [ ] Root `layout.tsx` wraps with `<ClerkProvider>`
- [ ] `NEXT_PUBLIC_CLERK_*` env vars added to `.env.example`

---

### T4.2T — Clerk webhook handler tests

**Status**: 🔴 Blocked by T3.2I
**Effort**: 0.5h
**Depends on**: T3.2I
**Parallel with**: T4.1

**Description**:
Write tests for the Clerk webhook handler before implementing it.

**Test File**: `tests/unit/server/webhooks/clerk.test.ts`

**Test Cases**:

- [ ] Request with invalid `svix` signature → returns HTTP 401
- [ ] Request with missing `svix` headers → returns HTTP 400
- [ ] Valid `user.created` event → calls `db.jobSeeker.upsert` with correct `clerkUserId`
- [ ] Valid `organization.created` event → calls `db.employer.upsert` with correct `clerkOrgId`
- [ ] Unknown event type → returns HTTP 200 (acknowledged, ignored)

**Mocking**: Mock `svix` `Webhook.verify()` for invalid/valid cases; mock `db.jobSeeker.upsert`.

**Confirm tests FAIL** before T4.2I.

---

### T4.2I — Implement Clerk webhook handler

**Status**: 🔴 Blocked by T4.2T
**Effort**: 1h
**Depends on**: T4.2T

```bash
pnpm add svix
```

**Acceptance Criteria**:

- [ ] All tests from T4.2T pass
- [ ] `import "server-only"` at top of file
- [ ] `svix` `Webhook` used with `CLERK_WEBHOOK_SECRET` for signature verification
- [ ] `user.created` handler: `db.jobSeeker.upsert({ where: { clerkUserId }, create: {...} })` stub
      with `// TODO Feature 3: populate profile fields`
- [ ] `organization.created` handler: `db.employer.upsert({ where: { clerkOrgId }, create: {...} })`
      stub with `// TODO Feature 4: populate org fields`
- [ ] Returns HTTP 401 on invalid signature (no other information leaked)
- [ ] Returns HTTP 200 on success

---

### T4.3 — Inngest client and route handler

**Status**: 🔴 Blocked by T4.2I
**Effort**: 0.5h
**Depends on**: T4.2I
**Parallel with**: T4.2I (after T4.2T)

```bash
pnpm add inngest
```

**Acceptance Criteria**:

- [ ] `src/server/inngest/client.ts`: `new Inngest({ id: "jobbobber", ... })` exported as `inngest`
- [ ] `src/server/inngest/functions/index.ts`: empty export array `[]` as placeholder
- [ ] `src/app/api/inngest/route.ts`: `serve({ client: inngest, functions })` with GET + POST handlers
- [ ] `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_DEV_SERVER_URL` added to `.env.example`
- [ ] `inngest` client imported into `createTRPCContext` in `src/server/api/trpc.ts`
      (enables procedures to fire events)
- [ ] Local dev: `pnpm dev` + `inngest dev` start without port conflicts
      (`INNGEST_DEV_SERVER_URL=http://localhost:8288`)

---

## Phase 5: Feature Flags + Observability

**Goal**: All feature flags defined and defaulting OFF; Sentry connected to production.

---

### T5.1T — Feature flags tests

**Status**: 🔴 Blocked by T4.3
**Effort**: 0.5h
**Depends on**: T4.3

**Description**:
Write tests for `src/lib/flags.ts` before implementing it.

**Test File**: `tests/unit/lib/flags.test.ts`

**Test Cases**:

- [ ] `SEEKER_PROFILE` flag returns `false` when no override is configured
- [ ] `EMPLOYER_PROFILE` flag returns `false` when no override is configured
- [ ] `AI_MATCHING` flag returns `false` when no override is configured
- [ ] `MATCH_DASHBOARD` flag returns `false` when no override is configured
- [ ] `FEEDBACK_INSIGHTS` flag returns `false` when no override is configured
- [ ] A flag explicitly overridden to `true` in test context returns `true`

**Confirm tests FAIL** before T5.1I.

---

### T5.1I — Implement feature flags (`src/lib/flags.ts`)

**Status**: 🔴 Blocked by T5.1T
**Effort**: 0.5h
**Depends on**: T5.1T

```bash
pnpm add @vercel/flags
```

**Acceptance Criteria**:

- [ ] All tests from T5.1T pass
- [ ] Five flags exported matching the contracts in `contracts/trpc-api.ts`:
      `SEEKER_PROFILE`, `EMPLOYER_PROFILE`, `AI_MATCHING`, `MATCH_DASHBOARD`, `FEEDBACK_INSIGHTS`
- [ ] Each flag uses `flag({ key: "...", defaultValue: false })` — all default to `false`
- [ ] `assertFlagEnabled(flag)` helper exported: throws `TRPCError({ code: "NOT_FOUND" })` if flag
      is OFF (used in procedure implementations, not as middleware)
- [ ] `VERCEL_FLAGS_SECRET` added to `.env.example`

---

### T5.2 — Encryption utility stub (`src/lib/encryption.ts`)

**Status**: 🔴 Blocked by T5.1I
**Effort**: 1h
**Depends on**: T5.1I
**Parallel with**: T5.3

**Description**:
Implement the AES-256-GCM encryption utility for BYOK key storage. This is used in Feature 2
but the stub must exist in Feature 1 to complete the server-only module boundary.

**Test File**: `tests/unit/lib/encryption.test.ts` (write tests FIRST)

**Test Cases** (write before implementation):

- [ ] `encrypt(plaintext, userId)` returns a non-empty string different from input
- [ ] `decrypt(encrypted, userId)` returns the original plaintext
- [ ] Same plaintext + same userId produces same ciphertext (deterministic IV from userId)
- [ ] Different userId produces different ciphertext (IV is user-specific)
- [ ] Empty string input throws `Error("Cannot encrypt empty value")`

**Implementation Acceptance Criteria**:

- [ ] `import "server-only"` at top
- [ ] AES-256-GCM using Node.js built-in `crypto` module (no external dependencies)
- [ ] IV derived from `HMAC-SHA256(ENCRYPTION_IV_SALT, userId)` — first 12 bytes
- [ ] Key from `ENCRYPTION_KEY` env var (hex-decoded 32 bytes)
- [ ] Ciphertext format: `base64(iv + authTag + encryptedData)`
- [ ] `ENCRYPTION_KEY` (64 hex chars) and `ENCRYPTION_IV_SALT` added to `.env.example`

---

### T5.3 — Sentry integration

**Status**: 🔴 Blocked by T5.1I
**Effort**: 0.5h
**Depends on**: T5.1I
**Parallel with**: T5.2

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Acceptance Criteria**:

- [ ] `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` created
- [ ] `next.config.js` wrapped with `withSentryConfig()`
- [ ] `SENTRY_DSN` in `.env.example`; `SENTRY_AUTH_TOKEN` in `.env.example` (CI-only)
- [ ] Error boundary in root `layout.tsx` (Sentry `ErrorBoundary` or Next.js `error.tsx`)
- [ ] Verify Sentry captures a test exception in development before completing this task
- [ ] **FR-028 (performance metrics)**: Enable Sentry Performance Monitoring:
  - `tracesSampleRate: 1.0` in development; `tracesSampleRate: 0.1` in production
  - `@sentry/nextjs` instruments Next.js page loads and API routes automatically
  - Verify API response times appear in Sentry Performance dashboard

---

### T5.4 — Security review: encryption utility

**Status**: 🔴 Blocked by T5.2
**Effort**: 0.5h
**Depends on**: T5.2
**Parallel with**: T5.3

**Description**:
Run the `security-reviewer` agent on `src/lib/encryption.ts` and `tests/unit/lib/encryption.test.ts`
before merging Feature 1. AES-256-GCM for BYOK key storage is security-critical; any implementation
flaw could expose user API keys.

**Delegate to**: `security-reviewer` agent

**Review Scope**:

- `src/lib/encryption.ts`
- `tests/unit/lib/encryption.test.ts`

**Acceptance Criteria**:

- [ ] No CRITICAL or HIGH severity findings
- [ ] IV derivation is unique per user (different userId → different IV confirmed)
- [ ] No plaintext key material logged or returned in error messages
- [ ] `import "server-only"` confirmed (encryption.ts must never bundle to client)
- [ ] Ciphertext format reviewed for correct IV+authTag+ciphertext concatenation
- [ ] MEDIUM findings documented in a `// SECURITY NOTE` comment inline if accepted

**Quality Gate ✓** — Encryption reviewed. Phase 5 complete.

---

## Phase 6: Deployment + Documentation

**Goal**: Production deployment live; local dev documented end-to-end.

---

### T6.1 — Vercel deployment configuration

**Status**: 🔴 Blocked by T5.2, T5.3
**Effort**: 1h
**Depends on**: T5.2, T5.3

**Description**:
Configure `package.json` build script to run migrations and connect to Vercel project.

**Acceptance Criteria**:

- [ ] `package.json` `build` script: `"prisma generate && prisma migrate deploy && next build"`
- [ ] `vercel.json` created (if needed for custom routing)
- [ ] All production env vars set in Vercel dashboard (both preview and production scopes)
- [ ] `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` both set in Vercel
- [ ] Vercel project connected to GitHub repository
- [ ] Test PR deployed to preview URL — migrations run, app loads, `/api/trpc/health.ping` returns 200
- [ ] Merge to `main` → production deployment successful, previous version rolls back on failure
- [ ] Deployment URL added to README

---

### T6.2 — README and developer documentation

**Status**: 🔴 Blocked by T6.1
**Effort**: 1h
**Depends on**: T6.1

**Description**:
Write `README.md` covering everything a developer needs to go from clone to running.

**Acceptance Criteria** (aligns with SC-001):

- [ ] Prerequisites section: Node 20+, pnpm, NeonDB account, Clerk account, Inngest account
- [ ] Setup steps ≤ 5 commands from clone to `pnpm dev` running
- [ ] All `package.json` scripts documented with one-line descriptions
- [ ] All environment variables documented (or pointer to `.env.example`)
- [ ] Database setup: `prisma migrate dev`, `pnpm db:seed`
- [ ] Test commands: `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`
- [ ] Link to `.specify/specs/1-foundation-infrastructure/` for architecture context
- [ ] A developer who has never seen the codebase can have a running local environment
      within 15 minutes by following the README alone (SC-001)

---

## Quality Gates Summary

| Gate                      | After Task | Checks                                                               |
| ------------------------- | ---------- | -------------------------------------------------------------------- |
| **QG-1: CI Green**        | T1.5       | All 4 CI jobs pass on a clean branch                                 |
| **QG-2: Database Ready**  | T2.4       | All 9 tables exist; seed produces correct row counts                 |
| **QG-3: API Reachable**   | T3.3       | E2E health check returns 200                                         |
| **QG-4: Deployment Live** | T6.1       | Production URL serves the app; migrations applied                    |
| **QG-5: Security Green**  | T5.4       | Encryption utility passes security review; no HIGH/CRITICAL findings |

---

## Dependency Graph

```
T1.1 (scaffold)
  ├─ T1.2T → T1.2I (env validation)
  ├─ T1.3 (lint/format)
  │     └─ T1.4T → T1.4I (test infra)
  │           └─ T1.5 (CI) ─────────────────────── QG-1
  │
  └─ T2.1 (prisma schema)  [parallel with T1.3+]
        └─ T2.2 (migration)
              └─ T2.3T → T2.3I (db singleton)
                    ├─ T2.4 (seed)
                    └─ T3.1T → T3.1I (trpc core)
                                  └─ T3.2T → T3.2I (router stubs)
                                                  └─ T3.3 (e2e) ── QG-3
                                                  │
                                                  ├─ T4.1 (clerk middleware)
                                                  ├─ T4.2T → T4.2I (webhook)
                                                  └─ T4.3 (inngest)
                                                              └─ T5.1T → T5.1I (flags)
                                                                            ├─ T5.2 (encryption) → T5.4 (security review) ── QG-5
                                                                            └─ T5.3 (sentry)
                                                                                  └─ T6.1 (vercel) ── QG-4
                                                                                        └─ T6.2 (readme)
```

---

## Parallelization Opportunities

| Parallel Group | Tasks        | Condition                                                     |
| -------------- | ------------ | ------------------------------------------------------------- |
| Group A        | T1.2T + T1.3 | Both unblock after T1.1                                       |
| Group B        | T1.5 + T2.1  | Both unblock after T1.4I (CI and schema independent)          |
| Group C        | T2.4 + T3.1T | Both unblock after T2.3I (seed and tRPC core independent)     |
| Group D        | T4.1 + T4.2T | Both unblock after T3.2I (middleware and webhook independent) |
| Group E        | T4.3 + T4.2I | T4.3 can start as soon as T4.2T is done (parallel with T4.2I) |
| Group F        | T5.2 + T5.3  | Both unblock after T5.1I (encryption and Sentry independent)  |

---

## Agent Delegation Map

For complex tasks, delegate to specialist agents:

| Task(s)         | Agent                 | Context                                  |
| --------------- | --------------------- | ---------------------------------------- |
| T2.3I, T2.4     | `backend-developer`   | Prisma 5, NeonDB, seed data              |
| T3.1I, T3.2I    | `react-nextjs-expert` | tRPC 11, Next.js 15 App Router, Clerk    |
| T4.2I           | `backend-developer`   | Svix webhook verification, Prisma upsert |
| T5.2            | `backend-developer`   | Node.js `crypto`, AES-256-GCM            |
| T5.2 (security) | `security-reviewer`   | BYOK encryption security review          |
| T6.1            | `react-nextjs-expert` | Vercel deployment, Next.js build config  |

---

## Completion Checklist

All success criteria from `spec.md`:

- [ ] **SC-001**: Developer can have running local environment within 15 minutes of cloning
- [ ] **SC-002**: CI pipeline completes in under 10 minutes
- [ ] **SC-003**: Code change merged to main reaches production within 15 minutes
- [ ] **SC-004**: TypeScript type checking produces zero errors on initial commit
- [ ] **SC-005**: Test coverage on all new code meets or exceeds 80%
- [ ] **SC-006**: All 9 core database entities present after setup command
- [ ] **SC-007**: Feature flag toggled in management interface reflects in app within 30 seconds
- [ ] **SC-008**: Runtime error in production captured with stack trace within 5 minutes

---

## Next Step

Run `/speckit-analyze` to validate consistency between `spec.md`, `plan.md`, `data-model.md`,
`contracts/trpc-api.ts`, and `tasks.md` before implementation begins.
