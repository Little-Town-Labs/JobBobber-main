# Cross-Artifact Analysis Report — API-Only Pivot

**Date:** 2026-04-30
**Artifacts Analyzed:** plan.md, tasks.md, data-model.md, contracts/api-v1.yaml, research.md, constitution.md
**Status:** ⚠️ Issues found — resolve before `/speckit-implement`

---

## Summary

| Check                     | Status | Issues                                 |
| ------------------------- | ------ | -------------------------------------- |
| Constitutional Compliance | ⚠️     | 2 amendments pending (not yet applied) |
| Spec → Plan Traceability  | ⚠️     | No spec.md exists for this pivot       |
| Plan → Tasks Coverage     | ⚠️     | 3 infrastructure tasks missing         |
| Data Model Consistency    | ⚠️     | 2 naming/coupling issues               |
| API Contract Validation   | ⚠️     | 1 naming mismatch, 1 scope gap         |
| Cross-Artifact Naming     | ⚠️     | Webhook event notation inconsistency   |
| Completeness              | ⚠️     | spec.md and PUBLIC_API flag absent     |

**Total Issues: 12**

- Critical: 1
- High: 4
- Medium: 5
- Low: 2

---

## 1. Constitutional Compliance

### Article I: Type Safety First

**Status:** ✅ Compliant (amendment pending)

`trpc-openapi` preserves Zod types as the canonical source of truth from DB through
to the REST response. The external JSON is generated from Zod schemas — type safety
is not broken.

**Amendment pending (not yet a violation):** Article I states the data flow chain as
"Database (Prisma) → API (tRPC) → UI (TypeScript)". The new REST path
`tRPC → trpc-openapi → External clients` is not in the chain. The plan correctly
identifies this and flags a constitution patch. Until amended, this is a known
deviation, not a violation. Task 6.4 must be completed before flag flip.

### Article II: Test-Driven Development

**Status:** ✅ Compliant

Every implementation task in tasks.md is blocked by a corresponding test task.
TDD pattern (RED → GREEN) is enforced throughout all 7 phases. Security review
checkpoints (Tasks 2.8, 3.8) are correctly placed after implementation, before
gate passage.

### Article III: BYOK Architecture

**Status:** ✅ Compliant

API keys (Task 2.x) are explicitly distinct from BYOK keys. Plan states: "API keys
are independent from BYOK keys (separate purpose and lifecycle)." BYOK storage and
encryption (`src/lib/encryption.ts`) is unchanged. No platform API keys introduced.

### Article IV: Minimal Abstractions

**Status:** ✅ Compliant

`trpc-openapi` is a thin adapter (adds metadata annotations, mounts one route
handler). No LangChain, no new agent framework, no abstraction layers added.
`@scalar/nextjs-api-reference` is a UI component only.

### Article V: Security & Privacy

**Status:** ✅ Compliant

Plan's security table covers: API key brute force, key exposure in logs, webhook
SSRF, private param scoping, seeker PII gating, webhook secret theft, mass key
generation, replay attacks. All mitigations are concrete and traceable to tasks.

### Article VI: Phased Rollout with Feature Flags

**Status:** ❌ Violation — `PUBLIC_API` flag not declared

Plan states: _"All `/api/v1/` endpoints are initially gated behind a `PUBLIC_API`
flag (already defined in Feature 28 spec)."_

**Finding:** `src/lib/flags.ts` contains 13 declared flags. `PUBLIC_API` is not
among them. Feature 28 spec defines the flag conceptually but it was never
implemented in code. The REST handler cannot gate on a non-existent flag.

**Fix required:** Add `PUBLIC_API` flag to `src/lib/flags.ts` and apply
`assertFlagEnabled(PUBLIC_API)` in the REST route handler. This is a blocking gap.

### Article VII: Agent Autonomy

**Status:** ✅ Compliant

Webhook callbacks (Phase 3) enable agents to react to match events without polling.
Agent-to-agent conversation logic (Inngest) is fully preserved and untouched.

---

## 2. Spec → Plan Traceability

### Status: ⚠️ CRITICAL — spec.md does not exist

The `api-only-pivot` directory has no `spec.md`. This pivot was derived from
conversation analysis and the existing Feature 28 spec, but no formal specification
document exists in the standard location.

**Impact:** The speckit workflow requires spec.md as the canonical "what" before
plan.md defines the "how". Without it, there is no traceable source of user stories
or acceptance criteria.

**The gap is partially mitigated** because:

- Feature 28 spec (`28-public-rest-api/spec.md`) covers the REST API surface in detail
- The pivot plan was derived from a thorough codebase archaeology and explicit
  architectural decisions documented in the conversation

**Required action:** Either (a) create a minimal spec.md that formalizes the pivot
user stories and acceptance criteria, OR (b) formally declare that Feature 28 spec
serves as the spec for the API surface and document the pivot as an architectural
change record rather than a new feature. Option (b) is lower cost given the plan
quality.

---

## 3. Plan → Tasks Coverage

### Plan Phase 0 → Tasks 0.1–0.5

**Status:** ⚠️ 3 missing tasks

All four Phase 0 work items are covered. However, three **infrastructure prerequisites**
are referenced in the plan but have no corresponding tasks:

**Missing Task A: Provision Upstash Redis in Vercel Marketplace**
Plan (Phase 0, P0-1): _"Provision Upstash Redis via Vercel Marketplace"_
No task exists for this. Without it, Task 0.2 (rate limiting implementation) cannot
be tested or verified. This is an infrastructure action that a person must take.

**Missing Task B: Declare `PUBLIC_API` feature flag in `src/lib/flags.ts`**
Plan references the flag throughout but no task creates it. Must be added before
the REST handler is built (Phase 1).

**Missing Task C: Confirm Stripe Price IDs in Vercel environment**
Plan (Next Steps, item 4): _"Confirm Stripe Price IDs are set in Vercel env."_
The plan correctly identifies this as a prerequisite but no task tracks it. A missing
Stripe Price ID produces a confusing Stripe API error at runtime.

### Plan Phase 1 → Tasks 1.1–1.3g

**Status:** ✅ Complete

All Phase 1 components have corresponding tasks. Router annotation parallelization
is correctly modeled. The integration test harness (Task 1.2) correctly unblocks
all annotation tasks.

### Plan Phases 2–6 → Tasks 2.x–6.x

**Status:** ✅ Complete with one sequencing issue

All plan components map to tasks. One sequencing issue:

**Task 6.3 (pgvector indexes) is in Phase 6 but depends only on Phase 0.**
Plan section "Performance Strategy" lists pgvector IVFFlat indexes as an action for
Phase 0 (`data-model.md` section "Migration Order" also places it at the end, after
model additions). The task is filed under Phase 6 in tasks.md, which means it won't
be applied until Phase 6. This delays a blocking performance fix that should be live
before any vector searches run through the API. Should be Task 1.4 (parallel with
Phase 1 router annotation work), not 6.3.

---

## 4. Data Model Consistency

### ApiKey model

**Status:** ✅ Consistent across all artifacts

`ApiKey` appears in data-model.md, plan.md (Phase 2 steps), tasks.md (Tasks 2.1–2.7),
and contracts/api-v1.yaml (`/api/v1/keys` endpoints). All references agree on:

- SHA-256 hash storage (plaintext never persisted)
- `keyPrefix` for display
- `ownerId` + `ownerType` scoping
- Max 10 keys per owner

### Webhook / WebhookDelivery models

**Status:** ✅ Consistent

All artifacts agree on model structure, max 5 subscriptions per owner, HMAC signing,
encrypted secret storage.

### `ApiKeyOwnerType` enum reused as `Webhook.ownerType`

**Status:** ⚠️ Naming/coupling issue

data-model.md reuses `ApiKeyOwnerType` for `Webhook.ownerType`:

```
ownerType   ApiKeyOwnerType   // Reuse SEEKER | EMPLOYER enum
```

The comment itself signals the smell: "Reuse" between two unrelated models
(`ApiKey` and `Webhook`) creates an implicit coupling. If a third owner type were
ever added (e.g., `TEAM`), both models would be affected.

**Recommendation:** Rename to `OwnerType` (or `ProfileType`) and apply to both
models. This is a one-word change in the Prisma schema and does not affect any
other artifact.

### Deprecated `urls` field cleanup

**Status:** ✅ Consistent — in data-model.md and Task 0.5

---

## 5. API Contract Validation

### Endpoint coverage vs plan

**Status:** ✅ All 17 plan endpoints present in contracts/api-v1.yaml

| Endpoint                             | In Plan | In Contract |
| ------------------------------------ | ------- | ----------- |
| GET /api/v1/health                   | ✅      | ✅          |
| GET/POST /api/v1/keys                | ✅      | ✅          |
| DELETE /api/v1/keys/:id              | ✅      | ✅          |
| GET/POST /api/v1/webhooks            | ✅      | ✅          |
| DELETE/POST /api/v1/webhooks/:id     | ✅      | ✅          |
| GET /api/v1/postings + /:id          | ✅      | ✅          |
| GET /api/v1/matches + accept/decline | ✅      | ✅          |
| GET/PATCH /api/v1/profile            | ✅      | ✅          |
| GET /api/v1/conversations + /:id     | ✅      | ✅          |
| GET /api/v1/insights                 | ✅      | ✅          |
| GET /api/v1/openapi.json             | ✅      | ✅          |

### Webhook event notation mismatch

**Status:** ⚠️ HIGH — inconsistency between contract and data model

contracts/api-v1.yaml defines `WebhookEvent` values in **dot notation**:

```yaml
enum: [match.created, match.accepted, match.declined, conversation.completed, subscription.changed]
```

data-model.md defines the Prisma `WebhookEvent` enum in **caps underscore**:

```prisma
enum WebhookEvent {
  MATCH_CREATED
  MATCH_ACCEPTED
  MATCH_DECLINED
  CONVERSATION_COMPLETED
  SUBSCRIPTION_CHANGED
}
```

These are for different layers (external JSON vs internal DB enum), so the
difference is correct in principle — but it is **not documented anywhere**.
`src/lib/webhooks.ts` will need an explicit mapping function between the two
notations. Without it, a developer implementing Task 3.3 will either:
(a) store dot-notation strings in the DB (breaking enum validation), or
(b) store caps-underscore in the payload (breaking the API contract).

**Fix:** Add a mapping table to data-model.md and to the contracts document.
Explicitly state: "Prisma enum values map to external event names as follows."

### Scope expansion: seekers + employers (departure from Feature 28)

**Status:** ⚠️ MEDIUM — undocumented departure

Feature 28 spec explicitly resolved: _"API access scope: Employer-only. Seeker API
can be added in a future iteration."_

This pivot plan expands the scope to both seekers and employers:

- `ApiKey.ownerType: ApiKeyOwnerType` supports both SEEKER and EMPLOYER
- contracts/api-v1.yaml `/profile` endpoint returns `SeekerProfile | EmployerProfile`
- tasks.md Task 2.6 tests "seeker key cannot access employer-scoped endpoints"

This is the right decision for the pivot. However, it is not explicitly called out
as a departure from the Feature 28 spec decision. This should be documented to
avoid confusion when Feature 28 is eventually implemented.

**Fix:** Add a note in plan.md (API Surface section) stating: "Note: Feature 28 spec
scoped the public API to employers only. This pivot intentionally expands scope to
both seekers and employers from the outset."

---

## 6. Cross-Artifact Naming Consistency

### "API key" vs "BYOK key"

**Status:** ✅ Consistent across all artifacts

All artifacts clearly distinguish between programmatic API keys (`jb_live_*`,
managed by `ApiKey` model) and BYOK LLM keys (OpenAI/Anthropic, managed by
`byokKey` on `JobSeeker`/`Employer`). No conflation found.

### Webhook event notation (external vs internal)

**Status:** ⚠️ See section 5 above — inconsistency not documented

### Key format

**Status:** ✅ Minor variation, not a conflict

- research.md: `jb_live_<base64url>`
- tasks.md: `jb_live_*`
- contracts/api-v1.yaml: `jb_live_<your-api-key>`

All refer to the same format. Not a conflict.

### "pivot" terminology

**Status:** ✅ Consistent — all artifacts refer to this as "api-only-pivot"

---

## 7. Additional Issues

### Welcome page mutation pattern (Medium)

**Task 5.3** states: "Page triggers `apiKeys.create` on first load."

Triggering a mutation (key creation) on page load is problematic:

- A page refresh creates a second key, burning the user's 10-key limit
- The raw key is not displayable on refresh (not stored), leaving the user with
  an inaccessible key

**Fix:** The `/welcome` page should show a "Generate your API key" button.
The key is created on explicit user action, not on load. On subsequent visits,
show key management UI (masked prefix list). Update Task 5.3 acceptance criteria.

### pgvector indexes sequencing (Medium)

**Task 6.3** is in Phase 6 but should be parallel with Phase 1.
See Plan → Tasks section above. Rename to Task 1.4 and move to Phase 1.

### Task 0.5 bundles two unrelated changes (Low)

Task 0.5 combines the deprecated `stripe` proxy removal with the `urls` field
migration. These have no code relationship and should be separate tasks for
clean PR diffs and independent review.

### Constitution amendment governance (Low)

Task 6.4 is marked "non-blocking, can be done any time." The constitution's
governance section requires: "Get team approval (all founding members)" before
merging. Task 6.4 should be unblocked immediately (the content is clear from the
plan) so the amendment can be reviewed in parallel with implementation, not
deferred until after the flag flip.

---

## 8. Issues Register

### Critical (1) — must fix before Phase 1

| #   | Issue                            | Location         | Fix                                                                                                                                  |
| --- | -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | No spec.md exists for this pivot | Missing artifact | Create minimal spec.md OR formally adopt Feature 28 spec as the API surface spec and document this as an architectural change record |

### High (4) — must fix before implementation of affected phase

| #   | Issue                                                                                                               | Location                             | Blocks             |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------ |
| H1  | `PUBLIC_API` feature flag not declared in `src/lib/flags.ts`                                                        | `src/lib/flags.ts`                   | Phase 1            |
| H2  | No task for provisioning Upstash Redis                                                                              | tasks.md                             | Phase 0 (Task 0.2) |
| H3  | Webhook event notation mismatch — mapping between dot-notation (API) and caps-underscore (Prisma enum) undocumented | data-model.md, contracts/api-v1.yaml | Phase 3            |
| H4  | Scope expansion (seekers + employers) departs from Feature 28 spec without documentation                            | plan.md                              | Audit risk         |

### Medium (5) — fix before affected task runs

| #   | Issue                                                                          | Location          | Fix                                |
| --- | ------------------------------------------------------------------------------ | ----------------- | ---------------------------------- |
| M1  | Welcome page creates API key on load (mutation on GET)                         | tasks.md Task 5.3 | Change to explicit button action   |
| M2  | `ApiKeyOwnerType` enum reused for Webhook model — naming is semantically wrong | data-model.md     | Rename enum to `OwnerType`         |
| M3  | pgvector index task (6.3) placed in Phase 6 instead of Phase 1                 | tasks.md          | Move to Phase 1 as Task 1.4        |
| M4  | Task 0.5 bundles unrelated cleanups                                            | tasks.md          | Split into two tasks               |
| M5  | No task to confirm Stripe Price IDs in Vercel environment                      | tasks.md          | Add as infrastructure prerequisite |

### Low (2) — fix when convenient

| #   | Issue                                                                                               | Location         | Fix                                         |
| --- | --------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| L1  | quickstart.md artifact not created                                                                  | Missing artifact | Create (optional per speckit-plan workflow) |
| L2  | Constitution amendment (Task 6.4) marked non-blocking; should start immediately for parallel review | tasks.md         | Remove "non-blocking" designation           |

---

## 9. Required Fixes Before `/speckit-implement`

### Fix C1: Create spec.md (or formal adoption notice)

Recommended approach — create a minimal spec.md that captures the pivot user
stories formally, referencing Feature 28 for the API surface detail:

```markdown
# Feature: API-Only Pivot

**Status:** Approved
**Supersedes:** Feature 28 spec (API surface), Features 3/4/6/9+ (UI removal)
**Date:** 2026-04-30
```

With 3–5 user stories covering: developer API access, webhook subscriptions,
registration funnel, and API documentation.

### Fix H1: Add PUBLIC_API flag

Add to `src/lib/flags.ts`:

```typescript
export const PUBLIC_API = flag<boolean>({
  key: "public-api",
  defaultValue: false,
  description: "Enable /api/v1/ REST endpoints for external agent access (api-only-pivot)",
  decide: () => false,
})
```

Add a new task: **Task 0.6: Declare PUBLIC_API feature flag** — blocks Task 1.1.

### Fix H2: Add infrastructure prerequisite tasks

Add to Phase 0 in tasks.md:

- **Task 0.0a**: Provision Upstash Redis in Vercel Marketplace (blocks 0.2)
- **Task 0.0b**: Confirm `STRIPE_PRICE_SEEKER_PRO` and `STRIPE_PRICE_EMPLOYER_BUSINESS` set in Vercel env (blocks Gate A)

### Fix H3: Document webhook event notation mapping

Add to data-model.md (WebhookEvent section):

```
External API (dot notation) → Prisma enum (caps underscore)
match.created              → MATCH_CREATED
match.accepted             → MATCH_ACCEPTED
match.declined             → MATCH_DECLINED
conversation.completed     → CONVERSATION_COMPLETED
subscription.changed       → SUBSCRIPTION_CHANGED

Mapping function required in src/lib/webhooks.ts.
```

### Fix H4: Document scope expansion

Add one sentence to plan.md API Surface section:

> Note: Feature 28 spec resolved API scope as employer-only. This pivot intentionally
> expands to both seekers and employers from the outset, superseding that decision.

### Fix M1: Welcome page button pattern

Update Task 5.3 acceptance criteria: replace "Page triggers `apiKeys.create` on
first load" with "User clicks 'Generate API key' button; server action creates key
and returns plaintext once."

---

## 10. Recommended Action Sequence

1. **Now (before any code):**
   - Create spec.md (C1)
   - Add `PUBLIC_API` to `flags.ts` as Task 0.6 (H1)
   - Add Tasks 0.0a and 0.0b (H2)
   - Update data-model.md with event notation mapping (H3)
   - Add scope note to plan.md (H4)
   - Fix Task 5.3 acceptance criteria (M1)
   - Rename `ApiKeyOwnerType` to `OwnerType` in data-model.md (M2)
   - Move Task 6.3 to Task 1.4 in tasks.md (M3)
   - Split Task 0.5 into 0.5a and 0.5b (M4)

2. **Before Phase 1:**
   - Upstash Redis provisioned (Task 0.0a)
   - Stripe Price IDs confirmed (Task 0.0b)
   - `PUBLIC_API` flag declared (Task 0.6)

3. **Parallel with implementation:**
   - Start constitution amendment process (Task 6.4 — begin early)

4. **Re-run `/speckit-analyze`** after fixes to confirm clean pass

---

## Conclusion

The artifact set is structurally sound — plan, data model, contracts, and tasks
are consistent with each other on the substantive design. The issues found are
primarily process gaps (missing spec.md, missing flag declaration, undocumented
scope expansion) and sequencing improvements (pgvector indexes, welcome page
mutation pattern), not design flaws. Resolving the 5 High/Critical items is
straightforward and can be done before the first line of implementation code
is written.

**Verdict:** ⚠️ Not ready for `/speckit-implement`. Address items C1 and H1–H4 first.
