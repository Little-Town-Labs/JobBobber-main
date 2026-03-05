# Implementation Plan — 5-basic-ai-matching

**Spec:** .specify/specs/5-basic-ai-matching/spec.md
**Branch:** 5-basic-ai-matching
**Date:** 2026-03-05

---

## Executive Summary

Implement one-directional AI matching: when an employer activates a job posting, an Inngest workflow evaluates all eligible job seeker profiles using the employer's BYOK API key via the Vercel AI SDK. The agent generates structured evaluations (score, confidence, summary) validated with Zod, which are persisted as Match records. A tRPC matches router exposes match listing, status management, and mutual-accept flows to both employers and job seekers.

**Key constraints:** No schema changes needed (all models exist). No agent-to-agent conversations. No private parameter access. LLM calls mocked in all tests.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Employer activates posting (updateStatus → ACTIVE)  │
└──────────────────────┬──────────────────────────────┘
                       │ inngest.send("matching/posting.activated")
                       ▼
┌─────────────────────────────────────────────────────┐
│  Inngest Workflow: evaluate-candidates               │
│                                                      │
│  1. Fetch employer + decrypt BYOK key               │
│  2. Find all eligible job seekers                    │
│  3. For each candidate:                              │
│     a. Build evaluation prompt                       │
│     b. Call LLM via Vercel AI SDK (generateObject)  │
│     c. Validate output with Zod schema               │
│     d. If score >= 30: create AgentConversation +   │
│        Match records                                 │
│  4. Report completion                                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  tRPC Matches Router                                 │
│                                                      │
│  listForPosting  — employer views matches            │
│  listForSeeker   — seeker views matches              │
│  getById         — detailed match view               │
│  updateStatus    — accept/decline                    │
│  getWorkflowStatus — check matching progress         │
└─────────────────────────────────────────────────────┘
```

---

## Technology Decisions

### TD-1: LLM Integration — Vercel AI SDK `generateObject`

**Context:** Need to call LLM and get structured output.
**Options:**
1. Vercel AI SDK `generateObject` with Zod schema
2. Direct OpenAI/Anthropic SDK calls with manual JSON parsing
3. Vercel AI SDK `generateText` with JSON mode

**Chosen:** Option 1 — `generateObject`
**Rationale:** Built-in Zod schema validation, automatic retries on parse failure, supports both OpenAI and Anthropic via provider adapters. Aligns with constitution (Minimal Abstractions — Vercel AI SDK is the designated tool).
**Tradeoffs:** Slightly less control over retry behavior vs. raw SDK.

### TD-2: Workflow Engine — Inngest

**Context:** Matching is a long-running async process that must survive restarts.
**Chosen:** Inngest (already in the stack, per constitution)
**Rationale:** Resumable workflows, built-in retry with backoff, event-driven, workflow state persists across server restarts. Already configured in the project.

### TD-3: BYOK Key Resolution — Decrypt at Execution Time

**Context:** Need the employer's API key to call the LLM.
**Chosen:** Decrypt from `employer.byokApiKeyEncrypted` using `src/lib/encryption.ts` at workflow start. Key is held in memory only for the duration of the workflow.
**Rationale:** Follows existing BYOK pattern from Feature 2. Key never persisted in Inngest workflow state.

### TD-4: Provider Adapter Selection

**Context:** BYOK key could be OpenAI or Anthropic.
**Chosen:** Dynamic provider selection based on `employer.byokProvider`:
- `"openai"` → `@ai-sdk/openai` createOpenAI
- `"anthropic"` → `@ai-sdk/anthropic` createAnthropic

Both packages already in dependencies.

### TD-5: Agent Prompt Strategy

**Context:** Need a reliable evaluation prompt.
**Chosen:** Typed prompt function (not string template). System prompt contains guardrails and evaluation instructions. User prompt contains the posting + candidate data as structured JSON.
**Rationale:** Constitution mandates "Agent prompts stored as typed functions (not strings)."

---

## Implementation Phases

### Phase 1: Agent Core (src/server/agents/)

Build the evaluation agent as a self-contained module.

**Files:**
- `src/server/agents/employer-agent.ts` — evaluation prompt builder, LLM call wrapper, output validation
- `src/server/agents/employer-agent.test.ts` — unit tests with mocked LLM
- `src/lib/matching-schemas.ts` — Zod schemas for evaluation input/output (from contracts)

**Key decisions:**
- `evaluateCandidate(posting, candidate, apiKey, provider)` → returns `AgentEvaluation | null`
- Uses `generateObject` from `ai` package with dynamic provider
- Returns `null` on validation failure (logged, not thrown)
- System prompt explicitly forbids consideration of protected characteristics

### Phase 2: Inngest Workflow (src/server/inngest/functions/)

Build the matching workflow that orchestrates evaluations.

**Files:**
- `src/server/inngest/functions/evaluate-candidates.ts` — main workflow
- `src/server/inngest/functions/evaluate-candidates.test.ts` — workflow tests

**Workflow steps (Inngest steps for resumability):**
1. `fetch-context` — Load posting, employer, decrypt BYOK key
2. `find-candidates` — Query eligible job seekers, exclude already-matched
3. `evaluate-batch` — For each candidate: evaluate, create records if score >= 30
4. `complete` — Update workflow metadata, report completion

**Key decisions:**
- Each candidate evaluation is its own Inngest step (resumable on failure)
- Batch size of 10 candidates per step invocation (avoid step explosion for large pools)
- 3 retries per batch with exponential backoff
- Partial results committed after each batch

### Phase 3: Matching Trigger Integration

Wire the Inngest event into the existing `updateStatus` procedure.

**Files:**
- `src/server/api/routers/jobPostings.ts` — add `inngest.send()` when DRAFT → ACTIVE
- `src/server/api/routers/jobPostings.test.ts` — update tests for event firing

**Key decisions:**
- Event sent after successful status update (not in a transaction — Inngest is eventually consistent)
- Event includes `jobPostingId` and `employerId`
- Only fires on DRAFT → ACTIVE transition (not PAUSED → ACTIVE reactivation in MVP)

### Phase 4: Matches Router (tRPC)

Expose match data to both employers and seekers.

**Files:**
- `src/server/api/routers/matches.ts` — expand existing stub with real procedures
- `src/server/api/routers/matches.test.ts` — unit tests with mocked DB
- `src/server/api/helpers/match-mapper.ts` — map Prisma Match to response types

**Procedures:**
- `listForPosting` — employerProcedure, paginated, sorted by score desc
- `listForSeeker` — seekerProcedure, paginated, sorted by createdAt desc
- `getById` — protectedProcedure, ownership check (seeker or employer)
- `updateStatus` — protectedProcedure, accept/decline with mutual-accept logic
- `getWorkflowStatus` — employerProcedure, returns workflow progress

**Key decisions:**
- Contact info populated on Match only when both sides accept (mutual accept)
- Contact info sourced from JobSeeker profile at accept time (not stored in advance)
- Match expiry handled by a scheduled Inngest cron (not in this feature — simple PENDING state for now)

### Phase 5: Frontend — Match Views

Create match listing and detail UI for both user types.

**Files:**
- `src/components/matches/match-card.tsx` — match summary card
- `src/components/matches/match-list.tsx` — paginated match list
- `src/components/matches/match-detail.tsx` — full match view with accept/decline
- `src/components/matches/workflow-status.tsx` — matching progress indicator
- `src/app/(employer)/postings/[id]/matches/page.tsx` — employer match list for posting
- `src/app/(seeker)/matches/page.tsx` — seeker match list

**Key decisions:**
- Match card shows: name, score, confidence badge, summary excerpt
- Detail view shows: full summary, strength areas, gap areas, accept/decline buttons
- Mutual accept state shows contact info
- Workflow status shown on posting detail page

### Phase 6: Security & Hardening

- Security review of agent prompt (no private param leakage)
- Verify BYOK key never appears in logs, Inngest state, or API responses
- Verify contact info only revealed after mutual accept
- Verify agent guardrails in evaluation output
- Code review of all new files

---

## Testing Strategy

### Unit Tests (Phase 1, 4)
- Agent evaluation with mocked `generateObject` — valid output, invalid output, schema validation
- Score-to-confidence mapping
- Prompt builder produces expected structure
- Match mapper excludes sensitive fields
- Match status transitions (PENDING → ACCEPTED, PENDING → DECLINED)
- Mutual accept logic (both accept → contact info revealed)

### Integration Tests (Phase 2, 3)
- Inngest workflow with mocked LLM — full workflow from trigger to match creation
- Workflow handles BYOK key not found, invalid key, LLM errors
- Workflow skips already-matched candidates
- updateStatus fires Inngest event on DRAFT → ACTIVE
- Matches router CRUD against test database

### Mock Strategy
- `generateObject` mocked to return predetermined evaluations
- Encryption module mocked (same as existing tests)
- Inngest client mocked for event sending in tRPC tests
- Real Prisma client for integration tests (existing pattern)

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| BYOK key exposure in workflow state | Decrypt in first step, pass in memory only, never serialize to Inngest step output |
| Private negotiation params | Not accessed at all in MVP (SeekerSettings, JobSettings private fields untouched) |
| Contact info pre-reveal | Match.seekerContactInfo populated only on mutual accept write |
| Agent discrimination | System prompt explicitly forbids, output validated for protected characteristic mentions |
| LLM prompt injection via profile data | Profile data injected as structured JSON (not concatenated strings), system prompt is immutable |

---

## Performance Considerations

| Scenario | Target | Approach |
|----------|--------|----------|
| Single evaluation | < 10s | Single LLM call per candidate |
| 100 candidates | < 20 min | Batched Inngest steps (10/batch), parallel within batch |
| 500 candidates | < 60 min | Same batching, workflow handles scale |
| Match list query | < 500ms | Indexed queries, no LLM calls at read time |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM hallucination in scores | Low match quality | Zod schema validation, score bounds enforced |
| BYOK key rate limiting | Workflow stalls | Exponential backoff, per-candidate retry, batch pacing |
| Large candidate pools | Slow workflow | Batched processing, progress tracking |
| Schema drift (Prisma models) | Runtime errors | No schema changes in this feature — uses existing models |

---

## Constitutional Compliance

- [x] **Type Safety First** — Zod schema validates all LLM output before storage
- [x] **TDD** — Tests first for agent, workflow, router, and UI
- [x] **BYOK Architecture** — Employer key used exclusively, no platform keys
- [x] **Minimal Abstractions** — Vercel AI SDK `generateObject` (designated tool), no LangChain
- [x] **Security & Privacy** — Private params excluded, BYOK key decrypted at runtime only
- [x] **Phased Rollout** — MVP scope bounded, behind feature flag consideration
- [x] **Agent Autonomy** — No human intervention in matching workflow

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| 1. Agent Core | 6 |
| 2. Inngest Workflow | 8 |
| 3. Trigger Integration | 2 |
| 4. Matches Router | 6 |
| 5. Frontend | 8 |
| 6. Security & Hardening | 3 |
| **Total** | **33** |

---

## Next Steps

1. Run `/speckit-tasks` to generate task breakdown
2. Begin implementation with Phase 1 (Agent Core)
3. Commit: `git commit -m "docs: add implementation plan for 5-basic-ai-matching"`
