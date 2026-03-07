# Implementation Plan: 1-foundation-infrastructure

**Feature Branch**: `1-foundation-infrastructure`
**Date**: 2026-02-23
**Status**: Ready for Implementation
**Spec**: `.specify/specs/1-foundation-infrastructure/spec.md`

---

## Executive Summary

Feature 1 establishes the complete technical foundation for JobBobber: a Next.js 15 (App Router)
project with tRPC 11, Prisma 5 on NeonDB, Clerk authentication scaffolding, Inngest async runtime,
Vercel AI SDK, and the Vercel Flags SDK. This feature produces no user-facing UI — its output is a
developer-ready project with working local dev, a CI/CD pipeline, a type-safe API layer, all nine
database tables migrated and seeded, and every subsequent feature gated behind feature flags that
default to OFF.

**Deliverables**:

- Bootstrapped Next.js 15 project with strict TypeScript 5
- Complete Prisma schema for all 9 MVP entities, migrated and seeded
- tRPC 11 router stubs for all 7 sub-routers (no business logic — just scaffold)
- GitHub Actions CI: type-check → lint → test → coverage gate → build
- Vercel deployment pipeline (preview per PR, production on main merge)
- Vitest + Playwright test infrastructure, 80% coverage gate enforced
- Vercel Flags SDK initialized; all feature flags default OFF

---

## Architecture Overview

### Project Directory Tree

```
jobbobber/
├── prisma/
│   ├── schema.prisma              # Authoritative data model (see data-model.md)
│   ├── migrations/                # Versioned migration files
│   └── seed.ts                    # Dev/preview seed data
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout (ClerkProvider wrapper)
│   │   ├── page.tsx               # Landing page placeholder
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/
│   │   │   │   └── route.ts       # tRPC HTTP handler
│   │   │   ├── inngest/
│   │   │   │   └── route.ts       # Inngest webhook handler
│   │   │   └── webhooks/
│   │   │       └── clerk/
│   │   │           └── route.ts   # Clerk webhook (user.created, org.created)
│   │   └── (auth)/
│   │       ├── sign-in/[[...sign-in]]/page.tsx
│   │       └── sign-up/[[...sign-up]]/page.tsx
│   │
│   ├── server/
│   │   ├── api/
│   │   │   ├── root.ts            # appRouter assembly
│   │   │   ├── trpc.ts            # createTRPCContext, middleware chain, procedure builders
│   │   │   └── routers/
│   │   │       ├── health.ts      # publicProcedure stubs
│   │   │       ├── job-seekers.ts # publicProcedure + protectedProcedure stubs
│   │   │       ├── employers.ts   # publicProcedure + employerProcedure stubs
│   │   │       ├── job-postings.ts
│   │   │       ├── matches.ts
│   │   │       ├── settings.ts    # seekerProcedure / employerProcedure (private only)
│   │   │       └── insights.ts    # seekerProcedure / employerProcedure
│   │   ├── db.ts                  # Prisma client singleton (import "server-only")
│   │   └── inngest/
│   │       ├── client.ts          # Inngest client singleton
│   │       └── functions/
│   │           └── index.ts       # Placeholder function registrations
│   │
│   ├── lib/
│   │   ├── env.ts                 # @t3-oss/env-nextjs schema (fail-fast on missing vars)
│   │   ├── encryption.ts          # AES-256-GCM BYOK key encryption (import "server-only")
│   │   ├── flags.ts               # Vercel Flags SDK wrappers (all default OFF)
│   │   └── trpc/
│   │       ├── client.tsx         # createTRPCReact() client
│   │       ├── server.ts          # createCaller() for RSC usage
│   │       └── query-client.ts    # TanStack Query config
│   │
│   ├── middleware.ts              # Clerk auth middleware (protects non-public routes)
│   │
│   └── types/
│       └── index.ts               # Shared TypeScript types (non-Prisma)
│
├── tests/
│   ├── unit/                      # Vitest unit tests
│   │   ├── lib/
│   │   │   ├── env.test.ts
│   │   │   └── encryption.test.ts
│   │   └── server/api/
│   │       ├── trpc.test.ts       # Context + middleware tests
│   │       └── routers/
│   │           └── health.test.ts
│   ├── integration/               # Vitest integration tests (real DB via test env)
│   │   └── db.test.ts
│   └── e2e/                       # Playwright tests
│       └── health.spec.ts
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions pipeline
│
├── .env.example                   # All vars documented; no secrets
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### Key Architectural Boundaries

```
┌──────────────────────────────────────────────────────────┐
│  CLIENT (Browser / RSC)                                  │
│  ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │ createTRPCReact() │   │ Server Components (RSC)       │ │
│  │ (TanStack Query)  │   │ createCaller() for SSR        │ │
│  └────────┬─────────┘   └──────────────┬───────────────┘ │
└───────────┼─────────────────────────────┼─────────────────┘
            │ HTTP POST /api/trpc         │ Direct call
            ▼                             ▼
┌──────────────────────────────────────────────────────────┐
│  TRPC HANDLER  /api/trpc/[trpc]/route.ts                 │
│  createTRPCContext()  →  Clerk auth()  →  appRouter      │
│                                                          │
│  Middleware Chain:                                        │
│  publicProcedure                                         │
│    └─ protectedProcedure (requiresAuth)                  │
│         ├─ seekerProcedure (requiresSeeker)              │
│         ├─ employerProcedure (requiresEmployer + role)   │
│         └─ adminProcedure (requiresOrgAdmin)             │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│  SERVER / DATABASE LAYER                                  │
│  db.ts (Prisma client singleton)                         │
│  NeonDB: pooled URL for queries, unpooled for migrations │
│  pgvector extension (vector(1536) — $queryRaw only)      │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│  ASYNC / BACKGROUND LAYER                                 │
│  Inngest client → /api/inngest route handler             │
│  Step functions for agent workflows (Feature 9+)         │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

All technology decisions are locked by the project constitution. Full rationale in
`research.md`. Summary:

| Layer            | Technology                        | Version         | Key Reason                                                            |
| ---------------- | --------------------------------- | --------------- | --------------------------------------------------------------------- |
| Framework        | Next.js                           | 15 (App Router) | Server Components, streaming, Vercel-native                           |
| Language         | TypeScript                        | 5 (strict)      | Type Safety First (Principle I)                                       |
| API              | tRPC                              | 11              | End-to-end type safety, no codegen, Zod dual-use                      |
| ORM              | Prisma                            | 5               | Schema-first, migration tracking, typed client                        |
| Database         | NeonDB (PostgreSQL 16 + pgvector) | —               | Serverless, pgvector avoids separate vector DB                        |
| Auth             | Clerk                             | —               | Organizations = multi-tenant employers; `auth()` gives userId+orgId   |
| Async            | Inngest                           | 3               | Resumable step functions; critical for multi-hour agent conversations |
| AI SDK           | Vercel AI SDK                     | 3               | Provider-agnostic, Zod-validated streaming                            |
| Feature Flags    | Vercel Flags SDK                  | —               | Edge evaluation, no external service at launch                        |
| Unit Tests       | Vitest                            | —               | Native ESM, Vite-compatible, Jest-compatible API                      |
| E2E Tests        | Playwright                        | —               | Multi-browser, auto-waits, Clerk testing utilities                    |
| Hosting          | Vercel                            | —               | Next.js-native, preview URLs per PR                                   |
| Error Monitoring | Sentry                            | —               | Source maps, alert on new error types                                 |

---

## Data Model

Full schema in `data-model.md`. The schema implements three privacy guarantees by construction:

1. **Settings isolation**: `SeekerSettings` and `JobSettings` are separate one-to-one models with
   `@unique` foreign keys. Standard Prisma `include` chains cannot accidentally expose them because
   they are never part of a public procedure's `select`.

2. **Clerk identity decoupling**: `clerkUserId` / `clerkOrgId` are stored as `String @unique` fields,
   not relational foreign keys. Clerk is the authoritative identity store; Prisma records are created
   lazily after the Clerk webhook fires.

3. **Vector embedding isolation**: `profileEmbedding` and `jobEmbedding` are `Unsupported("vector(1536)")`
   fields excluded from Prisma's typed query API. All vector similarity queries use `db.$queryRaw` and
   are restricted to dedicated server actions.

### Entity Summary

| Entity            | Table                 | Key Constraint                      | Privacy                       |
| ----------------- | --------------------- | ----------------------------------- | ----------------------------- |
| JobSeeker         | `job_seekers`         | `clerkUserId @unique`               | Public                        |
| SeekerSettings    | `seeker_settings`     | `seekerId @unique` (1:1 FK)         | PRIVATE — never in public API |
| Employer          | `employers`           | `clerkOrgId @unique`                | Public                        |
| EmployerMember    | `employer_members`    | `(employerId, clerkUserId) @unique` | Semi-public                   |
| JobPosting        | `job_postings`        | `employerId` FK, status index       | Public                        |
| JobSettings       | `job_settings`        | `jobPostingId @unique` (1:1 FK)     | PRIVATE — never in public API |
| AgentConversation | `agent_conversations` | `(seekerId, jobPostingId)` index    | Restricted                    |
| Match             | `matches`             | `conversationId @unique`            | Restricted                    |
| FeedbackInsights  | `feedback_insights`   | `(userId, userType) @unique`        | Aggregate only                |

---

## API Contracts

Full type-level contracts in `contracts/trpc-api.ts`. This feature implements **stubs only** —
all procedures exist and return the correct types but have no business logic. Business logic is
added in Features 2–18.

### Router Inventory

| Router        | Procedures                                                                         | Procedure Level                       | Notes                                         |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `health`      | `ping`, `status`                                                                   | `publicProcedure`                     | Infrastructure health only                    |
| `jobSeekers`  | `getProfile`, `getMyProfile`, `upsertMyProfile`, `deleteMyProfile`                 | Mixed                                 | Public read, authenticated write              |
| `employers`   | `getProfile`, `getMyOrg`, `upsertMyOrg`, `listMembers`, `removeMember`             | Mixed                                 | `adminProcedure` for member mutation          |
| `jobPostings` | `list`, `getById`, `create`, `update`, `updateStatus`, `delete`                    | Mixed                                 | Status transitions fire Inngest events        |
| `matches`     | `listForSeeker`, `listForEmployer`, `getById`, `respondToMatch`                    | Mixed                                 | Contact info withheld until mutual acceptance |
| `settings`    | `getSeekerSettings`, `upsertSeekerSettings`, `getJobSettings`, `upsertJobSettings` | `seekerProcedure`/`employerProcedure` | No `id` input — ownership from `ctx` only     |
| `insights`    | `getMyInsights`                                                                    | Mixed                                 | Behind `FEEDBACK_INSIGHTS` feature flag       |

### Context Hierarchy

```typescript
// Base (always available, even public)
TRPCContext { db, inngest, flags }

// After auth() from @clerk/nextjs/server
AuthenticatedContext extends TRPCContext {
  userId: string   // clerkUserId — never null in authenticated procedures
  orgId?: string
  orgRole?: string
}

// After seekerProcedure middleware resolves JobSeeker record
SeekerContext extends AuthenticatedContext {
  seeker: { id: string; clerkUserId: string }
}

// After employerProcedure middleware resolves Employer record
EmployerContext extends AuthenticatedContext {
  employer: { id: string; clerkOrgId: string }
  orgRole: string
}

// After adminProcedure verifies org:admin role
AdminContext extends EmployerContext {
  org: { role: 'org:admin' }
}
```

### Pagination Pattern

All `list*` procedures use cursor-based pagination on `id` (CUID):

```typescript
// Input (all list procedures)
{ cursor?: string; limit?: number }   // default limit: 20, max: 100

// Output (all list procedures)
{ items: T[]; nextCursor: string | null; hasMore: boolean }
```

Cursor on `id` guarantees: O(log N) via index seek, no page drift under concurrent inserts,
stable sort with `(createdAt DESC, id DESC)` tie-breaking.

---

## Implementation Phases

### Phase 1: Project Scaffold (Steps 1–5)

**Goal**: A compilable, deployable Next.js 15 project with zero business logic but a green build.

**Step 1 — Initialize project**

```bash
pnpm create next-app@latest jobbobber \
  --typescript --eslint --app --src-dir \
  --import-alias "@/*" --no-tailwind
pnpm add -D @types/node typescript@5
# Configure tsconfig.json: strict true, noUncheckedIndexedAccess true
```

**Step 2 — Environment validation**

- Install `@t3-oss/env-nextjs` and `zod`
- Write `src/lib/env.ts` — declare all required env vars with Zod schemas
- Build fails immediately if any required variable is absent
- Commit `.env.example` documenting all variables

**Step 3 — Linting and formatting**

- Configure ESLint with `@typescript-eslint/strict` rules
- Install and configure Prettier
- Install Husky + lint-staged; pre-commit hook runs `prettier --check` + `eslint`

**Step 4 — Test infrastructure**

- Install Vitest + `@vitest/coverage-v8`
- Write `vitest.config.ts` with `coverage.thresholds: { global: { lines: 80 } }`
- Install Playwright + `@playwright/test`
- Write `playwright.config.ts` pointing at `http://localhost:3000`
- Write first passing test: `tests/unit/lib/env.test.ts` (validates env schema)

**Step 5 — CI pipeline**

- Write `.github/workflows/ci.yml` with jobs: `typecheck` → `lint` → `test` → `build`
- Coverage gate: `vitest run --coverage` — pipeline fails if below 80%
- Branch protection: all 4 jobs required before merge

---

### Phase 2: Database Layer (Steps 6–9)

**Goal**: Complete Prisma schema, migrations applied, seed working.

**Step 6 — Prisma setup**

```bash
pnpm add prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

- Copy complete schema from `data-model.md` into `prisma/schema.prisma`
- Add `prisma generate` to `postinstall` script
- Configure `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` in `.env.example`

**Step 7 — pgvector extension**

- Add `previewFeatures = ["postgresqlExtensions"]` to generator block
- Add `extensions = [pgvector(map: "vector", schema: "public")]` to datasource
- Create and apply initial migration:
  ```bash
  DATABASE_URL=$DATABASE_URL_UNPOOLED npx prisma migrate dev --name init
  ```

**Step 8 — Prisma client singleton**

- Write `src/server/db.ts` with import `"server-only"` and global PrismaClient pattern
  (prevents multiple client instances in Next.js hot-reload dev)
- Add integration test `tests/integration/db.test.ts` that creates and deletes a test record

**Step 9 — Seed data**

- Write `prisma/seed.ts` per the seed design in `data-model.md`:
  5 seekers, 5 seeker settings, 3 employers, 6 members, 6 postings,
  6 job settings, 4 conversations, 3 matches, 4 feedback records
- Guard: `if (process.env.NODE_ENV === 'production') throw new Error('never seed production')`
- Add `"db:seed": "tsx prisma/seed.ts"` to package.json scripts
- Add `"db:reset": "prisma migrate reset --skip-seed && pnpm db:seed"`

---

### Phase 3: tRPC Layer (Steps 10–13)

**Goal**: Complete tRPC scaffold — all 7 routers with stub procedures, context hierarchy, middleware.

**Step 10 — tRPC core**

```bash
pnpm add @trpc/server @trpc/client @trpc/react-query @trpc/next
pnpm add @tanstack/react-query
```

- Write `src/server/api/trpc.ts`:
  - `createTRPCContext()` — calls `auth()` from `@clerk/nextjs/server`, attaches `db` and `inngest`
  - `publicProcedure`, `protectedProcedure`, `seekerProcedure`, `employerProcedure`, `adminProcedure`
  - Each middleware level writes the narrowed context type (see contracts/trpc-api.ts)

**Step 11 — Router stubs**

- Write all 7 router files in `src/server/api/routers/`
- Every procedure:
  - Accepts the correct Zod input schema (from `contracts/trpc-api.ts`)
  - Returns a mock/stub response of the correct type
  - Has a `// TODO: implement in Feature N` comment
- Write `src/server/api/root.ts` assembling all routers into `appRouter`

**Step 12 — HTTP handler and client**

- Write `src/app/api/trpc/[trpc]/route.ts` using `fetchRequestHandler`
- Write `src/lib/trpc/client.tsx` — `createTRPCReact<AppRouter>()`
- Write `src/lib/trpc/server.ts` — `createCaller()` for RSC usage
- Write `src/lib/trpc/query-client.ts` — TanStack Query config

**Step 13 — tRPC tests**

- Unit test `tests/unit/server/api/trpc.test.ts`: context creation, middleware rejection
- Unit test `tests/unit/server/api/routers/health.test.ts`: `ping` returns pong

---

### Phase 4: Clerk + Inngest Integration (Steps 14–16)

**Goal**: Auth middleware installed, Clerk webhook handler scaffolded, Inngest registered.

**Step 14 — Clerk middleware**

```bash
pnpm add @clerk/nextjs
```

- Write `src/middleware.ts` with `clerkMiddleware()`:
  - Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/trpc(.*)` (tRPC handles own auth),
    `/api/inngest(.*)`, `/api/webhooks/(.*)`
  - All other routes: protected

**Step 15 — Clerk webhook handler**

```bash
pnpm add svix
```

- Write `src/app/api/webhooks/clerk/route.ts`:
  - Verifies signature with `svix` using `CLERK_WEBHOOK_SECRET`
  - Handles `user.created` → creates `JobSeeker` record (stub: `// TODO Feature 3`)
  - Handles `organization.created` → creates `Employer` record (stub: `// TODO Feature 4`)
  - Rejects invalid signatures with 401
- Write unit test for signature verification logic

**Step 16 — Inngest**

```bash
pnpm add inngest
```

- Write `src/server/inngest/client.ts` — `new Inngest({ id: "jobbobber" })`
- Write `src/app/api/inngest/route.ts` — `serve({ client, functions: [] })` placeholder
- Export client from `src/server/inngest/client.ts` for future feature use

---

### Phase 5: Feature Flags + Observability (Steps 17–18)

**Goal**: Vercel Flags SDK initialized with all flags OFF; Sentry connected.

**Step 17 — Feature flags**

```bash
pnpm add @vercel/flags
```

- Write `src/lib/flags.ts` defining all feature flags from `contracts/trpc-api.ts`:
  ```typescript
  export const SEEKER_PROFILE = flag({ key: "SEEKER_PROFILE", defaultValue: false })
  export const EMPLOYER_PROFILE = flag({ key: "EMPLOYER_PROFILE", defaultValue: false })
  export const AI_MATCHING = flag({ key: "AI_MATCHING", defaultValue: false })
  export const MATCH_DASHBOARD = flag({ key: "MATCH_DASHBOARD", defaultValue: false })
  export const FEEDBACK_INSIGHTS = flag({ key: "FEEDBACK_INSIGHTS", defaultValue: false })
  ```
- Write unit test: all flags return `false` when no override is set

**Step 18 — Sentry**

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

- Configure `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Set `SENTRY_DSN` in `.env.example`
- Wrap custom error pages if needed

---

### Phase 6: Deployment + Documentation (Steps 19–20)

**Goal**: Production deployment live; README complete.

**Step 19 — Vercel deployment**

- Connect repository to Vercel project
- Set all production environment variables in Vercel dashboard
- Configure `DATABASE_URL_UNPOOLED` for build-time `prisma migrate deploy`
- Add to `package.json`:
  ```json
  "build": "prisma generate && prisma migrate deploy && next build"
  ```
- Push to main → verify production deployment succeeds

**Step 20 — README**

- Document: prerequisites, clone, setup command, all npm scripts, env vars,
  database setup, seed command, test commands, deployment process
- Include link to `project-config.json` for agent context

---

## Testing Strategy

### Unit Tests (Vitest)

| Test File                           | Coverage Target          | Key Assertions                                                 |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `lib/env.test.ts`                   | `src/lib/env.ts`         | Missing vars throw; valid config passes                        |
| `lib/encryption.test.ts`            | `src/lib/encryption.ts`  | Encrypt → decrypt round-trip; different IVs per call           |
| `lib/flags.test.ts`                 | `src/lib/flags.ts`       | All flags default to `false`                                   |
| `server/api/trpc.test.ts`           | `src/server/api/trpc.ts` | Unauthenticated call to protectedProcedure throws UNAUTHORIZED |
| `server/api/routers/health.test.ts` | `health.ts`              | `ping` returns `{ pong: true }`                                |
| `webhooks/clerk.test.ts`            | Clerk webhook handler    | Invalid signature → 401; valid `user.created` → upsert called  |

### Integration Tests (Vitest + real test DB)

| Test File                | Coverage Target | Key Assertions                                      |
| ------------------------ | --------------- | --------------------------------------------------- |
| `integration/db.test.ts` | Prisma client   | Can create, read, delete `JobSeeker` row in test DB |

**Integration test guard**: tests refuse to run unless `DATABASE_URL` contains `test` or
`localhost` — prevents accidental production DB writes.

### E2E Tests (Playwright)

| Test File            | User Flow                   | Key Assertions                                          |
| -------------------- | --------------------------- | ------------------------------------------------------- |
| `e2e/health.spec.ts` | `GET /api/trpc/health.ping` | Returns 200 with `{ result: { data: { pong: true } } }` |

### Coverage Gate

- **Threshold**: 80% lines, functions, branches (enforced in CI via `@vitest/coverage-v8`)
- **Exclusions**: `prisma/seed.ts`, `*.config.ts`, `src/app/api/*/route.ts` (Next.js boilerplate)
- **New code rule**: any code written for this feature must have tests written first (TDD)

---

## Deployment Strategy

### Preview Deployments (every PR)

- Vercel GitHub integration creates preview URL per PR
- Preview uses NeonDB branch (or dev DB) for isolation
- `prisma migrate deploy` runs automatically on Vercel build

### Production Deployment (merge to main)

1. GitHub Actions CI must pass (4 required checks)
2. Vercel build hook fires on main merge
3. `build` script: `prisma generate && prisma migrate deploy && next build`
4. Vercel routes traffic to new deployment only after health check passes
5. Previous deployment remains live during health check

### Zero-Downtime Guarantee

Vercel's instant rollback is available via dashboard. Migrations use `Restrict` on audit
tables (AgentConversation, Match) — no migration can silently drop a table with live
business data.

### Environment Variable Management

| Environment | Source                                          | Notes                             |
| ----------- | ----------------------------------------------- | --------------------------------- |
| Local dev   | `.env.local` (gitignored)                       | Copied from `.env.example`        |
| Preview     | Vercel Environment Variables (preview scope)    | Set once per project              |
| Production  | Vercel Environment Variables (production scope) | Set once per project              |
| CI          | GitHub Actions secrets                          | Passed as env vars to test runner |

---

## Security Considerations

### BYOK Architecture (Principle III)

No platform LLM API keys exist in any environment. `src/lib/encryption.ts` implements:

- AES-256-GCM with a 32-byte `ENCRYPTION_KEY` (server secret)
- Per-user IV derived from `HMAC-SHA256(ENCRYPTION_IV_SALT, clerkUserId)` (deterministic
  but secret; IV is stored alongside ciphertext for correctness)
- `import "server-only"` at the top of the file — prevents accidental client bundle inclusion
- The function is a stub in Feature 1; wired to actual BYOK flow in Feature 2

### Clerk Webhook Security

All Clerk webhook events verified by `svix` before any DB write. Unverified requests
return HTTP 401 immediately. `CLERK_WEBHOOK_SECRET` is server-only.

### tRPC Authorization Model

- Cross-org resource access returns `NOT_FOUND` (not `FORBIDDEN`) to prevent resource
  enumeration attacks
- `settings.getSeekerSettings` accepts no `id` input — the seeker identity comes from
  `ctx.seeker.id` (derived from the authenticated session) making unauthorized access
  structurally impossible

### Environment Isolation

Integration tests refuse to connect to production URLs. The `env.ts` validation includes
a `NODE_ENV !== 'production'` guard around test utilities.

---

## Risks and Mitigation

| Risk                                                             | Likelihood | Impact | Mitigation                                                                                |
| ---------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| NeonDB cold start adds latency to first query                    | Medium     | Low    | Use pooled URL; acceptable for dev setup                                                  |
| Prisma Unsupported pgvector type causes friction in queries      | Low        | Medium | All vector queries go through `$queryRaw` wrappers; documented in data-model.md           |
| Clerk webhook delivery delays create eventual-consistency window | Low        | Low    | Seeker/Employer records created lazily; tRPC procedures handle missing records gracefully |
| Coverage gate fails on initial CI run                            | Low        | Low    | Write tests for all Feature 1 code before merging; exclusion list in vitest.config.ts     |
| Inngest dev server conflicts with Next.js dev server ports       | Low        | Low    | `inngest dev` runs on port 8288 by default; `INNGEST_DEV_SERVER_URL` set in `.env.local`  |

---

## Constitutional Compliance

| Principle                | How This Plan Enforces It                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Type Safety           | TypeScript strict mode from step 1; tRPC + Zod ensure no unvalidated data crosses API boundaries; `env.ts` fails build on missing vars                                      |
| II. TDD                  | Every Phase 1–5 step specifies its test file(s) first; Vitest 80% gate in CI; tests written before business logic (stubs only in this feature)                              |
| III. BYOK                | `encryption.ts` stub created (server-only); no platform LLM keys in any env var list; `byokApiKeyEncrypted` field in schema                                                 |
| IV. Minimal Abstractions | No LangChain, no GraphQL gateway, no ORM-over-ORM; Vercel Flags SDK is the minimal flag primitive; Inngest replaces complex queue infrastructure                            |
| V. Security & Privacy    | `SeekerSettings` / `JobSettings` are separate models with structural isolation; Clerk webhook verified; `settings.*` procedures derive identity from session not user input |
| VI. Feature Flags        | All 5 feature flags defined in `flags.ts`; all default `false`; evaluated at Edge per request; flags documented in `contracts/trpc-api.ts`                                  |
| VII. Agent Autonomy      | Inngest client registered; `/api/inngest` route handler ready to accept function registrations from Feature 9+                                                              |

---

## Open Questions for Implementer

1. **Preview DB isolation**: Should each Vercel preview deployment get its own NeonDB branch,
   or share a shared dev branch? NeonDB branching is available but requires additional setup.
   _Recommended default_: shared dev branch for Feature 1 previews; revisit for Feature 9+.

2. **Test DB setup in CI**: CI needs a real PostgreSQL instance for integration tests.
   _Recommended_: GitHub Actions `services: postgres` block with a test database URL,
   or NeonDB dev branch URL stored as a CI secret.

3. **Sentry environment**: Sentry DSN can be shared across preview and production, or separate.
   _Recommended_: separate DSNs to keep production error noise clean.
