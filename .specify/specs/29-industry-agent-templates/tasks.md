# Task Breakdown: Feature 29 — Industry Agent Templates

**Plan:** .specify/specs/29-industry-agent-templates/plan.md
**Total Tasks:** 20
**Total Effort:** ~18 hours
**Critical Path:** 1.1 → 1.4 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 5.1 → 5.2 → 6.1 → 6.2

---

## Phase 1: Data Layer

### Task 1.1: Prisma Schema + Feature Flag

**Status:** 🟡 Ready
**Effort:** 0.75h
**Dependencies:** None

**Description:**
Add `IndustryTemplate` model, `JobSettings` fields, and feature flag.

**Acceptance Criteria:**

- [ ] `IndustryTemplate` model added to `prisma/schema.prisma` with: slug, version, name, description, industry, content (Json), summaryBullets, isDefault, isDeprecated
- [ ] `@@unique([slug, version])` constraint
- [ ] `templateVersionId` FK added to `JobSettings`
- [ ] `INDUSTRY_TEMPLATES` flag added to `src/lib/flags.ts`
- [ ] `prisma migrate dev` succeeds

---

### Task 1.2: Template Type Definitions Tests

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write tests for template content types and composition logic. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/lib/industry-templates.test.ts` written
- [ ] Tests cover: `composeTemplateBlock` output format, null/empty template produces empty string, General template produces empty block, valid TemplateContent validation, prompt length calculation, combined template+custom prompt length validation with truncation warning
- [ ] Tests confirmed to FAIL

---

### Task 1.3: Template Type Definitions Implementation

**Status:** 🔴 Blocked by 1.2
**Effort:** 1h
**Dependencies:** Task 1.2

**Description:**
Implement template content types, Zod schema, and composition function.

**Acceptance Criteria:**

- [ ] `src/lib/industry-templates.ts` created
- [ ] `TemplateContent` and `EvaluationDimension` interfaces defined
- [ ] `templateContentSchema` Zod schema for validation
- [ ] `composeTemplateBlock(content)` — returns prompt text for `<industry-template>` block
- [ ] `validateCombinedPromptLength(templateContent, customPrompt, maxLength)` — returns truncation warning if exceeded
- [ ] All tests from 1.2 pass

---

### Task 1.4: Seed Data

**Status:** 🔴 Blocked by 1.1, 1.3
**Effort:** 2h
**Dependencies:** Tasks 1.1, 1.3

**Description:**
Create seed data file with all 5 industry templates.

**Acceptance Criteria:**

- [ ] `prisma/seed-templates.ts` created
- [ ] 5 templates seeded: General, Technology/Engineering, Healthcare, Finance, Sales/Marketing
- [ ] Each template has: 5-6 evaluation dimensions with weights summing to ~1.0, terminology mappings, evaluation preamble, 4-6 summary bullets
- [ ] General template mirrors existing 6 dimensions with equal weights
- [ ] Seed script uses `upsert` on `[slug, version]` for idempotency
- [ ] Seed runs successfully

---

## Phase 2: Prompt Composition

### Task 2.1: Prompt Sandbox Tests

**Status:** 🔴 Blocked by 1.3
**Effort:** 1h
**Dependencies:** Task 1.3

**Description:**
Write tests for `buildTemplateBlock` and updated prompt composition. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/server/agents/prompt-sandbox.test.ts` updated with new tests
- [ ] Tests cover: `buildTemplateBlock` produces `<industry-template>` XML block, sandboxing text prevents override, null template produces empty string, XML-escaped content
- [ ] Tests for updated `buildEmployerSystemPrompt`: layering order (core → template → custom), backward compat (no template = same as before)
- [ ] Tests for updated `buildEvaluationPrompt`: accepts both `customPrompt?` and `templateContent?`, layering order matches system prompt, backward compat (no params = same as before)
- [ ] Tests confirmed to FAIL

---

### Task 2.2: Prompt Composition Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 1.5h
**Dependencies:** Task 2.1

**Description:**
Implement template block building and integrate into agent prompt pipeline.

**Acceptance Criteria:**

- [ ] `buildTemplateBlock(templateContent)` added to `src/server/agents/prompt-sandbox.ts`
- [ ] Returns `<industry-template>` XML block with evaluation preamble, dimensions, terminology
- [ ] Returns empty string for null input
- [ ] `buildEmployerSystemPrompt(phase, customPrompt?, templateContent?)` updated in `src/server/agents/employer-agent.ts`
- [ ] Template block inserted between core prompt and `<user-customization>` block
- [ ] `buildEvaluationPrompt(customPrompt?, templateContent?)` updated — must accept **both** `customPrompt?` and `templateContent?` to ensure the single-shot evaluation path composes all 5 prompt layers per FR-3
- [ ] `</?industry-template>` added to injection patterns in `src/server/agents/prompt-guard.ts`
- [ ] All tests from 2.1 pass
- [ ] All existing agent tests still pass (backward compatibility)

---

## Phase 3: API Layer

### Task 3.1: Router Tests

**Status:** 🔴 Blocked by 1.4
**Effort:** 1.5h
**Dependencies:** Task 1.4

**Description:**
Write tests for industry templates tRPC router and settings router changes. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/server/api/routers/industry-templates.test.ts` written
- [ ] Tests cover `list`: returns latest version per slug, excludes deprecated, gated by flag
- [ ] Tests cover `getById`: returns specific version
- [ ] Tests cover `checkUpdate`: detects newer version, returns null if current is latest
- [ ] Tests cover settings router: `updateJobSettings` accepts `templateVersionId`, rejects deprecated template, rejects non-existent ID
- [ ] Tests confirmed to FAIL

---

### Task 3.2: Router Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5h
**Dependencies:** Task 3.1

**Description:**
Implement industry templates tRPC router and extend settings router.

**Acceptance Criteria:**

- [ ] `src/server/api/routers/industry-templates.ts` created with `list`, `getById`, `checkUpdate` procedures
- [ ] Router registered in `src/server/api/root.ts`
- [ ] `updateJobSettings` in settings router accepts optional `templateVersionId`
- [ ] `getJobSettings` includes template relation data (name, slug, version, summaryBullets)
- [ ] Typed hooks added to `src/lib/trpc/hooks.ts`
- [ ] All tests from 3.1 pass

---

## Phase 4: Inngest Integration

### Task 4.1: Conversation Workflow Update

**Status:** 🔴 Blocked by 2.2
**Effort:** 1h
**Dependencies:** Task 2.2

**Description:**
Load template content during agent conversation and pass to prompt builder.

**Acceptance Criteria:**

- [ ] `run-agent-conversation.ts` `load-context` step loads `IndustryTemplate` when `jobSettings.templateVersionId` exists
- [ ] Parses `content` field via `templateContentSchema`
- [ ] Passes `TemplateContent` to `buildEmployerSystemPrompt` and `buildEvaluationPrompt`
- [ ] Null template (no selection) produces same behavior as before
- [ ] Existing conversation tests still pass

---

### Task 4.2: Conversation Integration Test

**Status:** 🔴 Blocked by 4.1
**Effort:** 0.5h
**Dependencies:** Task 4.1

**Description:**
Verify template content appears in generated prompts.

**Acceptance Criteria:**

- [ ] Test: conversation with Technology template produces prompt containing "Technical Skills Depth" dimension
- [ ] Test: conversation with no template produces prompt identical to pre-F29
- [ ] Test: conversation with template + custom prompt has both in correct order

---

## Phase 5: UI Layer

### Task 5.1: Component Tests

**Status:** 🔴 Blocked by 3.2
**Effort:** 1h
**Dependencies:** Task 3.2

**Description:**
Write tests for template selector component. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `tests/unit/components/settings/template-selector.test.tsx` written
- [ ] Tests cover: renders all 5 templates as radio options, selecting a template fires onChange, preview bullets expand on click, "update available" badge when newer version exists, feature flag gating (not rendered when disabled), General selected by default when no templateVersionId
- [ ] Tests confirmed to FAIL

---

### Task 5.2: TemplateSelector Component

**Status:** 🔴 Blocked by 5.1
**Effort:** 1.5h
**Dependencies:** Task 5.1

**Description:**
Implement template selector component.

**Acceptance Criteria:**

- [ ] `src/components/settings/template-selector.tsx` created
- [ ] Radio group with 5 options (General + 4 industry)
- [ ] Each option shows name and description
- [ ] Click expands to show summary bullets
- [ ] "Update available" badge from `checkUpdate` query
- [ ] Tooltip explaining template + custom prompt interaction
- [ ] Props: `value`, `onChange`
- [ ] All tests from 5.1 pass

---

### Task 5.3: Settings Page Integration

**Status:** 🔴 Blocked by 5.2
**Effort:** 0.5h
**Dependencies:** Task 5.2

**Description:**
Integrate template selector into posting settings page.

**Acceptance Criteria:**

- [ ] `TemplateSelector` rendered above custom prompt textarea in `/postings/[id]/settings/page.tsx`
- [ ] `templateVersionId` state added, initialized from loaded settings
- [ ] `templateVersionId` included in `updateSettings.mutate()` call
- [ ] Wrapped in feature flag check (not rendered when `INDUSTRY_TEMPLATES` off)

---

## Phase 6: Quality Gates

### Task 6.1: Edge Case Handling

**Status:** 🔴 Blocked by 5.3
**Effort:** 0.5h
**Dependencies:** Task 5.3

**Description:**
Handle deprecated template warning and prompt length validation in UI.

**Acceptance Criteria:**

- [ ] Settings page shows warning notice if posting's current template is deprecated
- [ ] Warning suggests switching to a replacement template
- [ ] If combined template + custom prompt exceeds length, show truncation warning below custom prompt textarea

---

### Task 6.2: Code Review

**Status:** 🔴 Blocked by 6.1, 4.2
**Effort:** 0.5h
**Dependencies:** Tasks 6.1, 4.2

**Description:**
Run `/code-review` on all new and modified files.

**Acceptance Criteria:**

- [ ] All CRITICAL and HIGH issues resolved
- [ ] No hardcoded values or console.log statements
- [ ] TypeScript compilation passes with zero errors
- [ ] Template sandboxing verified (cannot override core guardrails)

---

### Task 6.3: Full Test Suite Validation

**Status:** 🔴 Blocked by 6.2
**Effort:** 0.25h
**Dependencies:** Task 6.2

**Description:**
Run full test suite to verify no regressions.

**Acceptance Criteria:**

- [ ] All existing tests still pass (especially agent evaluation tests)
- [ ] New test coverage >= 80% for feature code
- [ ] Zero TypeScript errors

---

## Dependency Graph

```
1.1 (schema) ──────────────────┐
1.2 (type tests) → 1.3 (types) │
                       ↓        ↓
                  1.4 (seeds)
                       ↓
                  3.1 (router tests) → 3.2 (router impl)
                                            ↓
                                       5.1 (comp tests) → 5.2 (selector) → 5.3 (integration)
                                                                                    ↓
1.3 → 2.1 (sandbox tests) → 2.2 (composition)                                6.1 (edge cases)
                                  ↓                                                 ↓
                             4.1 (inngest) → 4.2 (integ test) ──────────→ 6.2 (review)
                                                                                    ↓
                                                                              6.3 (validation)
```

**Critical Path:** 1.1 → 1.4 → 3.1 → 3.2 → 5.1 → 5.2 → 5.3 → 6.1 → 6.2 → 6.3
**Parallel tracks:**

- Track A (data): 1.1 + 1.2/1.3 → 1.4 → 3.1 → 3.2 → 5.x
- Track B (prompt): 1.2/1.3 → 2.1 → 2.2 → 4.1 → 4.2
- Tracks converge at 6.2 (code review)
