# Task Breakdown: Feature 8 — Private Negotiation Parameters

**Branch:** 8-private-negotiation-parameters
**Plan:** .specify/specs/8-private-negotiation-parameters/plan.md

---

## Phase 1: Feature Flag + Input Schemas

### Task 1.1: Feature Flag — Tests

**Status:** ✅ Complete
**Effort:** 0.5h
**Dependencies:** None

**Description:**
Write tests for the PRIVATE_PARAMS feature flag and its gating behavior on all 4 settings procedures.

**Acceptance Criteria:**

- [ ] Test that PRIVATE_PARAMS flag exists and defaults to false
- [ ] Test that all 4 procedures throw NOT_FOUND when flag is OFF
- [ ] Test that procedures proceed when flag is ON
- [ ] Tests confirmed to FAIL

---

### Task 1.2: Feature Flag — Implementation

**Status:** ✅ Complete by 1.1
**Effort:** 0.5h
**Dependencies:** Task 1.1

**Description:**
Add `PRIVATE_PARAMS` flag to `src/lib/flags.ts`. Add `assertFlagEnabled(PRIVATE_PARAMS)` to all 4 settings procedures.

**Acceptance Criteria:**

- [ ] PRIVATE_PARAMS flag added following existing pattern
- [ ] All 4 procedures gated behind the flag
- [ ] All tests from 1.1 pass

---

### Task 1.3: Input Schema Completion — Tests

**Status:** ✅ Complete
**Effort:** 0.5h
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write validation tests for the complete input schemas: missing fields (`salaryRules`, `exclusions`, `willingToTrain`, `minQualOverride`), array length limits (max 20/10 items), string length limits (max 200 chars), salary non-negative constraint, urgency enum values.

**Acceptance Criteria:**

- [ ] Negative salary rejected
- [ ] Arrays exceeding max items rejected (20 for seeker, 10 for priorityAttrs)
- [ ] Strings exceeding 200 chars per item rejected
- [ ] Custom prompt exceeding 2000 chars rejected
- [ ] Invalid urgency enum rejected
- [ ] Valid inputs accepted
- [ ] Tests confirmed to FAIL

---

### Task 1.4: Input Schema Completion — Implementation

**Status:** ✅ Complete by 1.3
**Effort:** 0.5h
**Dependencies:** Task 1.3

**Description:**
Update `updateSeekerSettings` input to add `salaryRules` (json/record), `exclusions` (bounded string array). Update `updateJobSettings` input to add `willingToTrain` (bounded string array), `minQualOverride` (json/record). Apply array length and string length constraints per contracts.

**Acceptance Criteria:**

- [ ] All missing fields added to input schemas
- [ ] Bounded array validation (max items + max chars per item)
- [ ] All tests from 1.3 pass

---

## Phase 2: Router CRUD Implementation

### Task 2.1: Seeker Settings CRUD — Tests

**Status:** ✅ Complete by 1.2, 1.4
**Effort:** 1h
**Dependencies:** Tasks 1.2, 1.4

**Description:**
Write tests for `getSeekerSettings` and `updateSeekerSettings` procedures. Cover: read returns null when no settings exist, upsert creates new settings, upsert updates existing settings, all fields persisted correctly, identity comes from ctx.seeker.id (no ID input).

**Acceptance Criteria:**

- [ ] GET returns null for new seeker
- [ ] UPDATE creates settings via upsert
- [ ] UPDATE modifies existing settings
- [ ] All fields round-trip correctly (minSalary, salaryRules, dealBreakers, priorities, exclusions, customPrompt)
- [ ] Salary of 0 is allowed
- [ ] Tests confirmed to FAIL

---

### Task 2.2: Seeker Settings CRUD — Implementation

**Status:** ✅ Complete by 2.1
**Effort:** 1h
**Dependencies:** Task 2.1

**Description:**
Implement `getSeekerSettings` using `ctx.db.seekerSettings.findUnique({ where: { seekerId: ctx.seeker.id } })`. Implement `updateSeekerSettings` using `ctx.db.seekerSettings.upsert(...)` with ctx.seeker.id. Return only the fields defined in the contract (exclude BYOK fields).

**Acceptance Criteria:**

- [ ] GET queries by ctx.seeker.id, returns settings or null
- [ ] UPDATE upserts by seekerId
- [ ] BYOK fields never included in response
- [ ] All tests from 2.1 pass

---

### Task 2.3: Job Settings CRUD — Tests

**Status:** ✅ Complete by 1.2, 1.4
**Effort:** 1h
**Dependencies:** Tasks 1.2, 1.4
**Parallel with:** Task 2.1

**Description:**
Write tests for `getJobSettings` and `updateJobSettings` procedures. Cover: read returns null when no settings, upsert creates/updates, all fields persisted, ownership check (posting must belong to ctx.employer.id).

**Acceptance Criteria:**

- [ ] GET returns null for posting with no settings
- [ ] UPDATE creates settings via upsert
- [ ] UPDATE modifies existing settings
- [ ] All fields round-trip correctly (trueMaxSalary, minQualOverride, willingToTrain, urgency, priorityAttrs, customPrompt)
- [ ] Ownership enforced: employer can only access their own postings' settings
- [ ] Accessing another employer's posting settings returns FORBIDDEN/NOT_FOUND
- [ ] Tests confirmed to FAIL

---

### Task 2.4: Job Settings CRUD — Implementation

**Status:** ✅ Complete by 2.3
**Effort:** 1h
**Dependencies:** Task 2.3

**Description:**
Implement `getJobSettings`: verify posting belongs to ctx.employer.id, then query JobSettings. Implement `updateJobSettings`: verify ownership, then upsert. Return only contract-defined fields.

**Acceptance Criteria:**

- [ ] GET verifies posting ownership before returning
- [ ] UPDATE verifies posting ownership before upserting
- [ ] BYOK fields never included in response
- [ ] All tests from 2.3 pass

---

## Phase 3: Privacy Boundary Enforcement

### Task 3.1: Privacy Boundary — Tests

**Status:** ✅ Complete by 2.2, 2.4
**Effort:** 1h
**Dependencies:** Tasks 2.2, 2.4

**Description:**
Write dedicated privacy boundary tests. These are the most critical tests for this feature — they verify the core privacy invariant.

**Acceptance Criteria:**

- [ ] Employer cannot call getSeekerSettings (procedure is seekerProcedure — type-level block)
- [ ] Seeker cannot call getJobSettings (procedure is employerProcedure — type-level block)
- [ ] Employer A cannot read Employer B's job settings (ownership check)
- [ ] Settings fields never appear in any other router's response (grep/audit)
- [ ] GET returns NOT_FOUND (not empty data) for non-existent posting with wrong owner
- [ ] Tests confirmed to PASS (these test existing enforcement + new ownership checks)

---

## Phase 4: UI Pages

### Task 4.1: Seeker Private Settings Page — Tests

**Status:** ✅ Complete by 2.2
**Effort:** 0.5h
**Dependencies:** Task 2.2

**Description:**
Write component tests for the seeker private settings form: renders all fields, submits mutation, shows empty state, displays privacy notice, hidden when feature flag OFF.

**Acceptance Criteria:**

- [ ] Form renders all setting fields
- [ ] Submit calls updateSeekerSettings mutation
- [ ] Empty state shown when no settings exist
- [ ] Privacy notice visible
- [ ] Tests confirmed to FAIL

---

### Task 4.2: Seeker Private Settings Page — Implementation

**Status:** ✅ Complete by 4.1
**Effort:** 1.5h
**Dependencies:** Task 4.1

**Description:**
Create `/settings/private` page with form for all seeker private settings fields. Include clear privacy messaging. Gate behind PRIVATE_PARAMS flag.

**Acceptance Criteria:**

- [ ] Page at `/settings/private` or equivalent seeker route
- [ ] Form fields: minSalary, salaryRules, dealBreakers, priorities, exclusions, customPrompt
- [ ] Privacy notice: "These settings are never shared with employers"
- [ ] Feature flag conditional rendering
- [ ] All tests from 4.1 pass

---

### Task 4.3: Employer Job Settings Page — Tests

**Status:** ✅ Complete by 2.4
**Effort:** 0.5h
**Dependencies:** Task 2.4
**Parallel with:** Task 4.1

**Description:**
Write component tests for employer per-posting settings form: renders all fields, submits mutation, shows empty state, displays privacy notice, hidden when flag OFF.

**Acceptance Criteria:**

- [ ] Form renders all job setting fields
- [ ] Submit calls updateJobSettings mutation with jobPostingId
- [ ] Empty state shown when no settings exist
- [ ] Privacy notice visible
- [ ] Tests confirmed to FAIL

---

### Task 4.4: Employer Job Settings Page — Implementation

**Status:** ✅ Complete by 4.3
**Effort:** 1.5h
**Dependencies:** Task 4.3

**Description:**
Create per-posting settings page accessible from job posting management. Form for all job settings fields. Gate behind PRIVATE_PARAMS flag.

**Acceptance Criteria:**

- [ ] Page accessible from job posting detail/edit view
- [ ] Form fields: trueMaxSalary, minQualOverride, willingToTrain, urgency, priorityAttrs, customPrompt
- [ ] Privacy notice: "These settings are never shared with candidates"
- [ ] Feature flag conditional rendering
- [ ] All tests from 4.3 pass

---

## Phase 5: Hardening

### Task 5.1: Security Review

**Status:** ✅ Complete by 3.1, 4.2, 4.4
**Effort:** 0.5h
**Dependencies:** Tasks 3.1, 4.2, 4.4

**Description:**
Run `/security-review` on all changed files. Verify no IDOR vulnerabilities, no private data in logs, no settings leaking through other routers.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH security issues
- [ ] Grep codebase for any JOIN or include of SeekerSettings/JobSettings outside settings.ts
- [ ] No private field names in error messages

---

### Task 5.2: Code Review + Coverage

**Status:** ✅ Complete by 5.1
**Effort:** 0.5h
**Dependencies:** Task 5.1

**Description:**
Run `/code-review` on all changed files. Verify test coverage ≥ 80%. Fix any issues found.

**Acceptance Criteria:**

- [ ] Code review passed (no CRITICAL/HIGH issues)
- [ ] Test coverage ≥ 80% on new code
- [ ] All tests passing

---

### Task 5.3: E2E Test Stubs

**Status:** ✅ Complete by 4.2, 4.4
**Effort:** 0.5h
**Dependencies:** Tasks 4.2, 4.4
**Parallel with:** Task 5.1

**Description:**
Create E2E test stubs for private settings critical flows, gated behind `PLAYWRIGHT_E2E_ENABLED`.

**Acceptance Criteria:**

- [ ] E2E stub: seeker can save and reload private settings
- [ ] E2E stub: employer can save and reload per-posting settings
- [ ] E2E stub: settings page hidden when flag OFF
- [ ] Tests gated behind env var

---

## User Story → Task Mapping

| User Story                    | Tasks                                    |
| ----------------------------- | ---------------------------------------- |
| US-1: Seeker Private Settings | 1.3–1.4, 2.1–2.2, 4.1–4.2                |
| US-2: Employer Job Settings   | 1.3–1.4, 2.3–2.4, 4.3–4.4                |
| US-3: Privacy Boundary        | 3.1                                      |
| US-4: Feature Flag Gating     | 1.1–1.2                                  |
| US-5: Custom Agent Prompt     | Included in 2.1–2.4 (customPrompt field) |

---

## Critical Path

```
1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 5.1 → 5.2
                              ↗
1.3 → 1.4 → 2.3 → 2.4 → 4.4
```

**Duration on critical path:** ~7h

---

## Summary

- **Total Tasks:** 15
- **Phases:** 5
- **Parallelization:** Tasks 1.1/1.3 parallel; Tasks 2.1/2.3 parallel; Tasks 4.1/4.3 parallel; Task 5.3/5.1 parallel
