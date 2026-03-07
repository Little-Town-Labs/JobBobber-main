# Technology Research: 1-foundation-infrastructure

**Feature Branch**: `1-foundation-infrastructure`
**Date**: 2026-02-22
**Status**: Finalized (stack locked by project constitution v1.0.0)

---

## Overview

Most technology decisions for JobBobber's foundation are locked by the project constitution
(§Technical Constraints). This document records the rationale for each locked choice and
documents the few remaining open decisions that exist within the locked stack.

---

## Locked Technology Decisions (from constitution)

### TD-001: Next.js 15 + React 19 (App Router)

**Decision**: Use Next.js 15 with the App Router.

**Rationale**:

- Server Components reduce client JS bundle size and enable data fetching at the component
  level without client-side waterfalls.
- App Router's streaming and Suspense integration pairs well with AI features (streaming
  LLM responses) planned for Phase 1.
- Vercel's deployment platform is optimized for Next.js, enabling zero-config deployments
  with preview URLs per PR (FR-014, FR-015).

**Tradeoffs accepted**:

- App Router mental model is more complex than Pages Router.
- Some ecosystem libraries haven't fully adopted App Router patterns yet.

---

### TD-002: tRPC 11 for API Layer

**Decision**: tRPC 11 over REST or GraphQL.

**Rationale**:

- End-to-end type safety from server procedure input/output to React component props
  satisfies the constitutional Principle I (Type Safety First) without any code generation
  step.
- Zod schema definitions serve dual purpose: runtime validation AND TypeScript types.
- Eliminates an entire class of API contract drift bugs.
- tRPC v11 supports App Router natively with `createTRPCContext` from `@clerk/nextjs/server`.

**Alternatives considered**:

| Option                   | Verdict                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| REST + OpenAPI + codegen | Rejected: adds code generation step; types lag behind implementation               |
| GraphQL (Apollo/Pothos)  | Rejected: higher complexity; overfetch/underfetch less relevant for our shape      |
| Server Actions only      | Rejected: no type-safe client-side data fetching pattern; poor for complex queries |

---

### TD-003: Prisma 5 ORM

**Decision**: Prisma 5 over Drizzle ORM.

**Rationale**:

- Prisma's schema-first approach makes the data model the single source of truth.
- Migration system tracks applied migrations with a `_prisma_migrations` table; prevents
  schema drift (FR-022, FR-025).
- Prisma Client generates typed query builders that satisfy Principle I (Type Safety).
- `prisma generate` integrates cleanly into CI via `postinstall` script.

**Alternatives considered**:

| Option      | Verdict                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Drizzle ORM | Not chosen: sql-first style preferred by some, but Prisma's schema.prisma format is more readable for onboarding |
| Kysely      | Not chosen: manual migration management; no schema file                                                          |
| Raw SQL     | Not chosen: no type safety, rejected by constitution                                                             |

**Note on pgvector**: Prisma 5 does not natively model pgvector columns. Declared as
`Unsupported("vector(1536)")` and queried via `db.$queryRaw`. Vector indexes (HNSW or
IVFFlat) created as raw SQL migrations after data seeding.

---

### TD-004: NeonDB (PostgreSQL + pgvector)

**Decision**: NeonDB as the PostgreSQL host, with pgvector extension.

**Rationale**:

- Serverless Postgres: scales to zero between usage, cost-efficient at early stage.
- pgvector extension avoids a separate vector database (Pinecone/Weaviate) until scale
  warrants it; fewer external dependencies (Principle IV: Minimal Abstractions).
- Two connection URLs: pooled (`DATABASE_URL` via PgBouncer) for app queries, unpooled
  (`DATABASE_URL_UNPOOLED`) for Prisma migrations — a Neon-specific requirement.
- Branching feature enables per-PR database branches in the future.

**pgvector dimension**: 1536 matches OpenAI `text-embedding-3-large`. If Anthropic
embeddings (1024 dims) become the primary provider, a migration changes the dimension.
Dimension must be decided before production embeddings are generated (Feature 11).

---

### TD-005: Clerk for Authentication

**Decision**: Clerk over NextAuth, Auth0, or custom JWT.

**Rationale**:

- Organizations feature maps directly to the Employer multi-tenancy model: each employer
  is a Clerk Organization; employee roles (ADMIN, JOB_POSTER, VIEWER) map to Clerk org roles.
- `auth()` from `@clerk/nextjs/server` provides `userId`, `orgId`, and `orgRole` in one
  call — the exact context fields the tRPC middleware chain needs.
- Handles MFA, SSO, session management, and CSRF without custom code (Principle IV).
- Webhook events (user.created, organization.created) sync Clerk state to Prisma tables.

**Key integration point**: `clerkUserId` and `clerkOrgId` stored as `String @unique` in
Prisma, not foreign keys. Clerk is the authoritative identity store. Prisma records are
created lazily on first profile interaction after the Clerk webhook fires.

---

### TD-006: Inngest 3 for Async Workflows

**Decision**: Inngest 3 for background and long-running work.

**Rationale**:

- Resumable functions: an agent-to-agent conversation that runs for 30 minutes across
  multiple LLM API calls is not viable as a single serverless function invocation.
  Inngest's step functions resume after each step, with no timeout limit.
- Durable execution: if a step fails, Inngest retries only that step (not the whole job).
  Critical for expensive LLM calls.
- Local development: `inngest dev` runs a local Inngest server; no external service needed
  for local development.
- Event-driven: tRPC mutations fire `inngest.send()` events; Inngest functions subscribe.
  Decouples the HTTP layer from the workflow layer.

**Alternatives considered**:

| Option              | Verdict                                                        |
| ------------------- | -------------------------------------------------------------- |
| BullMQ              | Rejected: stateless; job restarts from scratch on failure      |
| Vercel Cron + Queue | Rejected: no step-level durability or resume                   |
| AWS Step Functions  | Rejected: too heavy; vendor lock-in; unnecessary complexity    |
| Trigger.dev         | Viable alternative, but Inngest already in project-config.json |

---

### TD-007: Vercel AI SDK 3

**Decision**: Vercel AI SDK 3 for all LLM interactions.

**Rationale**:

- `streamText` / `streamObject` provide streaming responses and structured output with
  Zod schema validation in one call — satisfying Principle I (Type Safety).
- `generateObject` returns Zod-validated objects synchronously for agent evaluation tasks.
- Provider-agnostic: same SDK works with OpenAI, Anthropic, and other providers via
  provider packages. Critical for BYOK (Principle III) where the provider is user-supplied.
- Built-in tool calling support for the agent tool pattern (Feature 9+).

**No LangChain / LangGraph** — explicitly prohibited by Principle IV. The Vercel AI SDK
provides the minimal abstraction needed.

---

### TD-008: Vercel Flags SDK for Feature Flags

**Decision**: Vercel Flags SDK over LaunchDarkly, Flagsmith, or custom feature flags.

**Rationale**:

- Edge evaluation: flags evaluated at request time with zero added latency (flags are
  evaluated in Edge Middleware, not via external API calls).
- No external service dependency for MVP: the SDK defaults to local evaluation.
- Satisfies FR-018 through FR-021 without adding a paid external service at launch.
- Constitutional Principle VI mandates ALL beta features behind flags; the SDK integration
  path is the lowest-friction way to enforce this.

---

### TD-009: Vitest for Unit and Integration Tests

**Decision**: Vitest over Jest.

**Rationale**:

- Native ESM support: Next.js 15 + TypeScript 5 uses ES modules; Jest requires
  additional transpilation configuration.
- Vite-compatible: same config as the build toolchain.
- `vi.mock()` replaces `jest.mock()` with the same API — low migration cost if switching.
- Coverage via `@vitest/coverage-v8` integrates cleanly with the 80% gate in CI.

---

### TD-010: Playwright for E2E Tests

**Decision**: Playwright is the E2E framework.

**Rationale**:

- Browser automation that covers Chromium, Firefox, and WebKit from one test run.
- Auto-waits: no `sleep()` calls or flaky timing issues in the test suite.
- `@clerk/testing` provides utilities for Clerk-authenticated Playwright sessions.
- Integrates with Vercel preview deployments for PR-level E2E runs.

---

## Open Decisions within the Locked Stack

### OD-001: Database connection pooling strategy

**Question**: Should we use Prisma's Accelerate (Prisma's own connection pool + caching
layer) in addition to NeonDB's built-in PgBouncer?

**Current decision**: Use NeonDB's PgBouncer (pooled URL) for app queries, direct URL
for migrations. Defer Prisma Accelerate until connection limits become a problem.

**Revisit trigger**: >50 concurrent database connections in production.

---

### OD-002: Monorepo vs. single-package repository

**Question**: As the platform grows to mobile apps and worker services, should the
repository be a monorepo?

**Current decision**: Single Next.js project. The agent workers (Inngest functions) live
within `src/server/inngest/`. If a standalone worker process is needed in Phase 3+,
extract at that time using Turborepo.

**Revisit trigger**: Inngest functions need to be deployed independently of the Next.js app.

---

### OD-003: Email delivery provider

**Question**: Which transactional email provider to use for match notifications (Feature 6)?

**Current decision**: Leave abstract for Feature 6 specification. Candidates: Resend,
Postmark, SendGrid. Foundation scaffolds the Inngest `send-notifications` function
signature; the provider is wired in Feature 6.

---

### OD-004: pgvector index type: IVFFlat vs. HNSW

**Question**: When generating vector indexes (Feature 11), which algorithm to use?

**Current decision**: Defer to Feature 11 specification. HNSW is generally preferred for
recall quality; IVFFlat may be faster to build on large tables. The Prisma schema scaffolds
the column; the index is a raw SQL migration owned by Feature 11.

**Revisit trigger**: Feature 11 planning phase.

---

## Environment Variables (Complete Foundation List)

See `data-model.md` → Environment section for the full variable list and grouping rationale.
All variables validated at startup by `src/lib/env.ts` using `@t3-oss/env-nextjs` (Zod-based).
The build fails fast if any required variable is missing — no silent `undefined` at runtime.

---

## Security Research Notes

- **Encryption for BYOK keys**: AES-256-GCM with a per-user IV derived from the user's
  Clerk userId + a server-side salt. The encryption key is a 32-byte server secret
  (`ENCRYPTION_KEY` env var). The encrypted value and IV are stored together in
  `SeekerSettings.byokApiKeyEncrypted`. Implementation lives in `src/lib/encryption.ts`
  with `import "server-only"` at the top.

- **Clerk webhook verification**: All Clerk webhook events are verified using
  `svix` (Clerk's webhook signature library) before any Prisma writes. The
  `CLERK_WEBHOOK_SECRET` env var holds the signing secret. Any request with an invalid
  signature is rejected with HTTP 401.

- **Inngest webhook security**: Inngest webhook requests are signed using `INNGEST_SIGNING_KEY`.
  The `serve()` call from `inngest/next` handles verification automatically.

- **CSRF**: tRPC uses HTTP POST for mutations; the Clerk session cookie uses `SameSite=Strict`.
  No additional CSRF token mechanism needed.

- **Rate limiting**: Not implemented at the Next.js layer in Feature 1. Rate limiting at
  the edge (Vercel Firewall or middleware) is an option for Phase 3 (Feature 18).
  Inngest function-level rate limiting handles agent conversation throttling.
