# Cross-Artifact Analysis: 1-foundation-infrastructure

**Date**: 2026-02-23
**Artifacts Analyzed**: 7
**Analyzer**: speckit-analyze

---

## Summary

| Check | Result |
|-------|--------|
| Constitutional Compliance | ✅ Compliant (0 violations, 1 documented deferral) |
| Spec → Plan Alignment | ✅ 28/28 FRs addressed (1 FR partially addressed) |
| Plan → Tasks Coverage | ⚠️ 3 gaps found |
| Data Model Consistency | ⚠️ 2 inconsistencies found |
| API Contract Validity | ⚠️ 3 inconsistencies found |
| Cross-Artifact Naming | ⚠️ 2 naming mismatches |
| Completeness | ✅ All required artifacts present |

**Total Issues**: 6
**Critical**: 0
**High**: 3 (fixed inline)
**Medium**: 3 (fixed inline)

---

## 1. Constitutional Compliance

### Principle I: Type Safety First
**Status**: ✅ Compliant

- `plan.md`: TypeScript strict mode from step 1; tRPC + Zod at all API boundaries; `env.ts` fails build on missing vars
- `tasks.md`: T1.1 enforces `tsconfig.json` strict mode; T3.1I specifies Zod input schemas per contract
- `contracts/trpc-api.ts`: All inputs/outputs typed; no `any` in public interfaces

### Principle II: Test-Driven Development
**Status**: ✅ Compliant

- `tasks.md` enforces TDD with paired `T`/`I` tasks; every non-trivial file has a test task that must FAIL before implementation starts
- Vitest 80% coverage gate enforced in CI (T1.4I, T1.5)
- AI agent logic is not present in this feature — deferred to Feature 9

### Principle III: BYOK Architecture
**Status**: ✅ Compliant

- No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in environment variable lists (data-model.md, research.md, plan.md)
- `SeekerSettings.byokApiKeyEncrypted` field scaffolded in schema
- `src/lib/encryption.ts` stub with AES-256-GCM specified (T5.2)
- Constitution requires "Key validation REQUIRED before saving" — noted as `// TODO Feature 2` in stub

### Principle IV: Minimal Abstractions
**Status**: ✅ Compliant

- No LangChain, LangGraph, or heavy AI frameworks in any artifact
- Direct Vercel AI SDK specified (research.md TD-007)
- Inngest chosen over heavier alternatives (research.md TD-006)

### Principle V: Security & Privacy
**Status**: ✅ Compliant

- `SeekerSettings` and `JobSettings` are separate Prisma models; never included in public procedures
- All API endpoints use typed procedure levels (publicProcedure through adminProcedure)
- BYOK key encryption specified (T5.2)
- Clerk webhook verification with svix (T4.2I)
- `NOT_FOUND` used instead of `FORBIDDEN` for cross-org access (documented in contracts)
- **Gap**: No explicit security review task in tasks.md — addressed below

### Principle VI: Feature Flags
**Status**: ✅ Compliant

- All 5 feature flags defined with `defaultValue: false` (T5.1I)
- Flags evaluated per-handler (not as middleware) per contracts/trpc-api.ts
- `VERCEL_FLAGS_SECRET` in env.example

### Principle VII: Agent Autonomy
**Status**: ✅ Compliant (scaffolded for Feature 9+)

- Inngest client registered; `/api/inngest` route handler ready
- `inngest` attached to `createTRPCContext` — procedures can fire events
- Multi-hour conversation support enabled by Inngest step functions

### Documented Deferral

**Tailwind CSS 3 + shadcn/ui** (locked in constitution Technical Constraints):
- Feature 1 produces no user-facing UI; Tailwind+shadcn deferred to Feature 3/4
- Acceptable: plan.md explicitly states "no user-facing UI — its output is a developer-ready project"
- Resolution: add setup steps to Feature 3 (job seeker profile) spec

---

## 2. Spec → Plan Alignment

### FR Coverage

All 28 functional requirements from `spec.md` are addressed:

| FR | Requirement | Plan Coverage |
|----|-------------|---------------|
| FR-001 | Single dev start command | T1.1 (Next.js scaffold) |
| FR-002 | Hot reload | T1.1 (Next.js App Router native) |
| FR-003 | Seed command | T2.4 (prisma seed.ts) |
| FR-004 | README documentation | T6.2 |
| FR-005 | TypeScript strict mode | T1.1, T1.5 (CI typecheck) |
| FR-006 | Type-safe data flow DB→API→client | T3.1I, T3.2I (tRPC + Prisma) |
| FR-007 | External input validation with schemas | T1.2I (env.ts), T3.2I (Zod in procedures) |
| FR-008 | CI type-check step | T1.5 |
| FR-009 | Automated tests on every PR | T1.5 (CI) |
| FR-010 | 80% coverage threshold | T1.4I (vitest.config.ts), T1.5 |
| FR-011 | Linter on every PR | T1.3, T1.5 |
| FR-012 | Auto-format + pre-commit hook | T1.3 (Husky + lint-staged) |
| FR-013 | Merge blocked if CI failing | T1.5 (branch protection) |
| FR-014 | Preview deployment per PR | T6.1 (Vercel) |
| FR-015 | Auto production deploy on main merge | T6.1 |
| FR-016 | Zero-downtime deployment | T6.1 (Vercel instant rollback) |
| FR-017 | Deployment traceable to commit | T6.1 (Vercel dashboard) |
| FR-018 | Feature flag support | T5.1I (Vercel Flags SDK) |
| FR-019 | Feature flags default OFF | T5.1I (`defaultValue: false`) |
| FR-020 | Flags evaluated at request time | T5.1I (edge evaluation) |
| FR-021 | Gradual rollout support | T5.1I (Vercel Flags SDK supports %) |
| FR-022 | Version-controlled schema migrations | T2.1, T2.2 (Prisma migrations) |
| FR-023 | All 9 entities in schema | T2.1 (complete Prisma schema) |
| FR-024 | Auto-apply migrations in preview/prod | T6.1 (`prisma migrate deploy` in build) |
| FR-025 | Migration locking (prevent concurrent) | T2.2 (Prisma advisory lock built-in) |
| FR-026 | Production error capture | T5.3 (Sentry) |
| FR-027 | Alert on new error types | T5.3 (Sentry issue alerts) |
| FR-028 | **Performance metrics** | ⚠️ Partially addressed — see Issue #1 |

---

## 3. Issues Found

### Issue #1 (High) — FR-028 not fully addressed: performance metrics

**Location**: `tasks.md` T5.3

**Problem**: FR-028 requires "Basic performance metrics (page load, API response time) MUST be tracked
in production." `tasks.md` T5.3 sets up Sentry for error monitoring but does not explicitly enable
Sentry Performance Monitoring (tracing), which is a separate opt-in configuration.

**Fix**: Update T5.3 acceptance criteria to include Sentry performance tracing.

**Status**: ✅ Fixed in tasks.md (see below)

---

### Issue #2 (High) — `health.ping` output contract mismatch

**Locations**: `tasks.md` T3.2T, T3.3; `plan.md`; `contracts/trpc-api.ts`

**Problem**: Three-way inconsistency in the `health.ping` output type:
- `tasks.md` T3.2T test cases: `health.ping` returns `{ pong: true }`
- `plan.md` stub description: `ping`: returns `{ pong: true }`
- `contracts/trpc-api.ts` HealthPingOutput: `{ status: "ok"; timestamp: string }`

Additionally, `tasks.md` references `health.status` as a procedure name, but the contract defines
`health.deepCheck`. The procedure name is inconsistent across plan/tasks vs contract.

**Fix**: `contracts/trpc-api.ts` is the authoritative source. Update `tasks.md` and `plan.md`
references to match the contract.

**Status**: ✅ Fixed in tasks.md (see below)

---

### Issue #3 (High) — No security review quality gate in tasks.md

**Location**: `tasks.md`

**Problem**: The constitution Development Workflow requires "Security review for sensitive features."
`T5.2` implements AES-256-GCM encryption for BYOK key storage — this is security-critical code that
must be reviewed by the `security-reviewer` agent before Feature 1 merges.

**Fix**: Add security review task after T5.2.

**Status**: ✅ Fixed in tasks.md (see below)

---

### Issue #4 (Medium) — `WorkLocationType` vs `LocationType` naming mismatch

**Locations**: `contracts/trpc-api.ts` (line 94), `data-model.md` (Prisma schema `LocationType` enum)

**Problem**: The Prisma schema defines `enum LocationType { REMOTE, HYBRID, ONSITE }` and the
`JobPosting` model field is `locationType: LocationType`. The contracts file defines
`type WorkLocationType = "REMOTE" | "HYBRID" | "ONSITE"` (same values, different name).

This will cause confusion when implementing `jobPostings.ts` — the router must map between
Prisma's `LocationType` and the contract's `WorkLocationType`.

**Fix**: Add an implementer note to `contracts/trpc-api.ts`. The values match; the name difference
is intentional API clarity ("work location" is more descriptive than "location type"). Document this
explicitly so the implementer knows to alias/map rather than search for a bug.

**Status**: ✅ Fixed in contracts/trpc-api.ts (note added)

---

### Issue #5 (Medium) — `MatchStatus` contract vs `MatchPartyStatus` schema design

**Locations**: `contracts/trpc-api.ts` (MatchStatus type), `data-model.md` (Match model)

**Problem**: The schema stores match state as two separate fields:
```
Match.seekerStatus: MatchPartyStatus   // PENDING | ACCEPTED | DECLINED | EXPIRED
Match.employerStatus: MatchPartyStatus // PENDING | ACCEPTED | DECLINED | EXPIRED
```

The contract exposes a single derived `MatchStatus` with composite states:
```
"SEEKER_ACCEPTED" | "EMPLOYER_ACCEPTED" | "MUTUALLY_ACCEPTED" | ...
```

These are consistent by design (the API layer derives the combined status from the two Prisma fields),
but this derivation logic is undocumented. Without documentation, the implementer may try to store
`MatchStatus` directly in the DB or write incorrect derivation logic.

**Fix**: Add derivation logic documentation to `contracts/trpc-api.ts`.

**Status**: ✅ Fixed in contracts/trpc-api.ts (note added)

---

### Issue #6 (Medium) — `inngest` and `flags` missing from TRPCContext interface

**Location**: `contracts/trpc-api.ts` TRPCContext interface

**Problem**: `plan.md` states that `createTRPCContext()` attaches `db` and `inngest` to context.
The `contracts/trpc-api.ts` TRPCContext interface only declares `db`, `userId`, `orgId`, `orgRole`,
`userRole`. The `inngest` client reference is missing from the type contract.

Feature flags are invoked per-handler via `assertFlagEnabled()` (not stored in context), so they
don't need to appear in the context type. But `inngest` does — procedures that fire events use
`ctx.inngest.send(...)`.

**Fix**: Add `inngest` field to TRPCContext in contracts/trpc-api.ts.

**Status**: ✅ Fixed in contracts/trpc-api.ts (see below)

---

## 4. Data Model Validation

### Entity Coverage (FR-023)

All 9 entities from spec.md present in data-model.md:
- [x] JobSeeker
- [x] SeekerSettings (PRIVATE)
- [x] Employer
- [x] EmployerMember
- [x] JobPosting
- [x] JobSettings (PRIVATE)
- [x] AgentConversation
- [x] Match
- [x] FeedbackInsights

### Relationship Validation

- [x] JobSeeker (1) → (1) SeekerSettings — Cascade delete ✅
- [x] Employer (1) → (N) EmployerMember — Cascade delete ✅
- [x] Employer (1) → (N) JobPosting — Cascade delete ✅
- [x] JobPosting (1) → (1) JobSettings — Cascade delete ✅
- [x] JobSeeker/JobPosting (1) → (N) AgentConversation — Restrict ✅
- [x] AgentConversation (1) → (1) Match — Restrict ✅
- [x] FeedbackInsights → JobSeeker/Employer — Cascade ✅

### Known Design Decision (not an issue)

`PublicJobSeekerProfile.experienceLevel` in contracts/trpc-api.ts does not have a corresponding
field in the `JobSeeker` Prisma model. This field will be added to the schema in Feature 3
(job-seeker-profile) when the full profile model is built out. The contract is forward-looking;
the stub implementation in Feature 1 will return `null` / a default value.

---

## 5. API Contract Validation

### Endpoint → User Story Coverage

| User Story | Related FRs | Procedure(s) | Status |
|-----------|-------------|-------------|--------|
| US-1 (dev starts immediately) | FR-001–FR-004 | `health.ping`, `health.deepCheck` | ✅ |
| US-2 (safe CI) | FR-005–FR-013 | (CI pipeline, not API) | ✅ |
| US-3 (reliable deployment) | FR-014–FR-017 | (Vercel, not API) | ✅ |
| US-4 (feature flags) | FR-018–FR-021 | `assertFlagEnabled()` per handler | ✅ |
| US-5 (DB schema) | FR-022–FR-025 | (Prisma/migration, not API) | ✅ |
| US-6 (error monitoring) | FR-026–FR-028 | (Sentry, not API) | ✅ |

All contracts for the stub procedures use correct Zod input shapes and output types.

---

## 6. Completeness Audit

### Required Artifacts
- [x] `.specify/memory/constitution.md`
- [x] `spec.md`
- [x] `plan.md`
- [x] `tasks.md`
- [x] `data-model.md`
- [x] `contracts/trpc-api.ts`
- [x] `research.md`
- [x] `checklists/requirements.md`

### Optional Artifacts
- [x] `research.md` (technology decisions)
- [ ] `quickstart.md` (developer getting-started guide) — deferred to T6.2 (README covers this)

---

## 7. Validation Result

**Status**: ✅ READY FOR IMPLEMENTATION (after inline fixes below)

All 6 issues are addressed:
- Issues #1, #2, #3 fixed in `tasks.md`
- Issues #4, #5, #6 fixed in `contracts/trpc-api.ts`

No critical or blocking issues remain. Implementation may proceed with `/speckit-implement`.
