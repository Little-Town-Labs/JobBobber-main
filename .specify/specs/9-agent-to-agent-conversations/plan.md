# Implementation Plan: Agent-to-Agent Conversations

**Feature:** 9-agent-to-agent-conversations
**Specification:** spec.md
**Status:** Draft
**Created:** 2026-03-06

---

## Executive Summary

Feature 9 transforms JobBobber's matching from one-directional evaluation (Feature 5) to multi-turn agent-to-agent conversations. The implementation adds a Job Seeker Agent, a conversation orchestration Inngest workflow, privacy-preserving prompt construction, and a new `AGENT_CONVERSATIONS` feature flag. The existing `AgentConversation` schema already supports the data model — no migration needed.

---

## Architecture Overview

```
Posting Activated
       │
       ▼
evaluate-candidates (Feature 5 Inngest fn — modified)
       │ scores candidates, filters by threshold
       ▼
For each candidate above threshold:
       │
       ▼
run-agent-conversation (NEW Inngest fn)
       ├─ Step 1: Load context (posting, profiles, private settings, BYOK keys)
       ├─ Step 2–N: Alternating turns
       │    ├─ Employer Agent turn (employer's BYOK key)
       │    │    └─ generateObject() → ConversationTurnSchema
       │    └─ Job Seeker Agent turn (seeker's BYOK key)
       │         └─ generateObject() → ConversationTurnSchema
       ├─ After each turn: persist message, check termination
       ├─ On mutual MATCH: create Match record
       └─ On NO_MATCH or max turns: mark COMPLETED_NO_MATCH
```

### Key Components

| Component                 | Location                                                 | Purpose                                           |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Job Seeker Agent          | `src/server/agents/seeker-agent.ts`                      | Evaluates opportunities from seeker's perspective |
| Conversation Orchestrator | `src/server/agents/conversation-orchestrator.ts`         | Manages turn-taking, phase tracking, termination  |
| Inngest Workflow          | `src/server/inngest/functions/run-agent-conversation.ts` | Resumable workflow for each conversation          |
| Privacy Filter            | `src/server/agents/privacy-filter.ts`                    | Strips private values from agent output           |
| Conversation Schemas      | `src/lib/conversation-schemas.ts`                        | Zod schemas for messages, turns, decisions        |
| Feature Flag              | `src/lib/flags.ts`                                       | `AGENT_CONVERSATIONS` flag                        |

---

## Technical Decisions

### TD-1: Inngest Step-Per-Turn vs Single Long Function

**Context:** How to structure the conversation workflow.

**Options:**

1. **One Inngest step per turn** — each agent turn is a separate `step.run()` call
2. **Single long function** — loop within one step

**Chosen:** Option 1 — one step per turn

**Rationale:** Inngest steps are the resumability boundary. If the workflow is interrupted mid-conversation, it resumes from the last completed step. Per-turn steps give maximum durability. Each step also creates an observable checkpoint in the Inngest dashboard.

**Tradeoffs:** More Inngest step invocations (slightly higher overhead), but gains durability and observability.

### TD-2: Two Separate Agent Files vs One Shared Agent

**Context:** Code organization for employer and seeker agents.

**Options:**

1. **Separate files** — `employer-agent.ts` (exists) + `seeker-agent.ts` (new)
2. **Shared agent factory** — one file with role parameter

**Chosen:** Option 1 — separate files

**Rationale:** The agents have fundamentally different system prompts, private parameter shapes, and evaluation criteria. Shared code would require excessive branching. The existing `employer-agent.ts` already establishes this pattern. Shared utilities (provider factory, privacy filter) are extracted into separate files.

**Tradeoffs:** Some duplication in prompt structure, but each agent's logic remains clear and independently testable.

### TD-3: Privacy Filter Strategy

**Context:** How to prevent private parameter values from leaking into stored messages.

**Options:**

1. **Post-generation filter** — regex/pattern-match agent output for numeric values that match private params
2. **Prompt-only approach** — rely solely on system prompt instructions
3. **Both** — prompt instructions + post-generation validation

**Chosen:** Option 3 — belt and suspenders

**Rationale:** LLMs can't be trusted to perfectly follow instructions. Post-generation filtering catches leaks the prompt couldn't prevent. The filter checks for exact numeric values from private params appearing in message content.

**Tradeoffs:** Slight overhead per message, but essential for privacy.

### TD-4: Conversation-to-Match Flow (Feature 5 Modification)

**Context:** Feature 5 currently creates `AgentConversation` + `Match` in one shot (single employer evaluation). Feature 9 needs multi-turn conversations that _may_ produce a match.

**Options:**

1. **Modify evaluate-candidates** to dispatch conversation workflows instead of creating matches directly
2. **Keep evaluate-candidates unchanged**, add a separate trigger

**Chosen:** Option 1 — modify evaluate-candidates

**Rationale:** When the `AGENT_CONVERSATIONS` flag is ON, evaluate-candidates should dispatch `run-agent-conversation` events for above-threshold candidates instead of creating direct matches. When the flag is OFF, Feature 5 behavior is unchanged. This preserves backward compatibility via feature flag gating.

**Tradeoffs:** evaluate-candidates gains a conditional branch, but the logic is clean: flag check → dispatch events vs create matches.

---

## Data Model

### Existing Schema (No Migration Needed)

The `AgentConversation` model already has all required fields:

| Field          | Type               | Usage in Feature 9                                              |
| -------------- | ------------------ | --------------------------------------------------------------- |
| `id`           | String (cuid)      | Primary key                                                     |
| `jobPostingId` | String             | FK to JobPosting                                                |
| `seekerId`     | String             | FK to JobSeeker                                                 |
| `status`       | ConversationStatus | IN_PROGRESS → COMPLETED_MATCH / COMPLETED_NO_MATCH / TERMINATED |
| `messages`     | Json[]             | Array of ConversationMessage objects                            |
| `startedAt`    | DateTime           | Conversation start time                                         |
| `completedAt`  | DateTime?          | When conversation ended                                         |
| `outcome`      | String?            | Brief outcome summary                                           |
| `inngestRunId` | String?            | Links to Inngest workflow run for O(1) lookup                   |

### ConversationMessage Shape (enforced by Zod, stored in `messages` Json[])

```typescript
{
  role: "employer_agent" | "seeker_agent",
  content: string,
  phase: "discovery" | "screening" | "deep_evaluation" | "negotiation" | "decision",
  timestamp: string, // ISO 8601
  turnNumber: number,
  decision?: "MATCH" | "NO_MATCH" | "CONTINUE"
}
```

### Match Record

Existing `Match` model unchanged. The `conversationId` foreign key links to the conversation that produced the match. Feature 9 creates Match records only on mutual MATCH signal.

---

## API Contracts

### New tRPC Procedures

No new user-facing tRPC procedures are needed for Feature 9. Conversations are fully automated — users don't interact with them directly. The existing matches router (Feature 5/6) surfaces the results.

### New Inngest Events

| Event                          | Payload                                  | Trigger                                                            |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------ |
| `conversations/start`          | `{ jobPostingId, seekerId, employerId }` | evaluate-candidates dispatches when AGENT_CONVERSATIONS flag is ON |
| `conversations/turn.completed` | `{ conversationId, turnNumber, status }` | Internal — for observability                                       |

### New Inngest Function

**`run-agent-conversation`**

- Trigger: `conversations/start`
- Steps: `load-context`, `turn-0` through `turn-N`, `create-match` (conditional)
- Retries: 3 per step
- Concurrency: limit 50 per `jobPostingId` (via Inngest concurrency key)

---

## Implementation Phases

### Phase 1: Foundation — Schemas, Privacy Filter, Feature Flag

- Add `AGENT_CONVERSATIONS` feature flag to `src/lib/flags.ts`
- Create `src/lib/conversation-schemas.ts` — Zod schemas for message shape, turn decisions
- Create `src/server/agents/privacy-filter.ts` — strips private param values from text
- Create `src/server/agents/seeker-agent.ts` — Job Seeker Agent with prompt + generateObject
- Tests first for all components (TDD)

### Phase 2: Conversation Orchestrator

- Create `src/server/agents/conversation-orchestrator.ts` — manages turn-taking, phase progression, termination evaluation
- Input: posting, candidate, private settings for both sides, BYOK keys
- Output: final conversation status + optional match data
- Tests with mocked LLM responses

### Phase 3: Inngest Workflow

- Create `src/server/inngest/functions/run-agent-conversation.ts`
- One step per turn, using the orchestrator
- Persist messages after each step
- Create Match record on mutual MATCH
- Register in `src/server/inngest/functions/index.ts`
- Tests with mocked Inngest step runner

### Phase 4: Feature 5 Integration

- Modify `src/server/inngest/functions/evaluate-candidates.ts`
  - When `AGENT_CONVERSATIONS` flag is ON: send `conversations/start` events for above-threshold candidates
  - When flag is OFF: existing behavior (direct match creation)
- Update existing evaluate-candidates tests

### Phase 5: Hardening & Quality

- Privacy filter integration test (verify no private values in stored messages)
- Guardrail violation detection and termination
- Concurrent conversation limit enforcement
- Edge case tests (invalid BYOK key mid-conversation, posting deactivated, etc.)
- Update Feature 5 tests to cover new branching

---

## Security Considerations

| Concern                               | Mitigation                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Private parameter leakage in messages | Privacy filter + prompt instructions (belt & suspenders)                                |
| BYOK key exposure in workflow state   | Keys decrypted per-step, never stored in Inngest event payload or conversation messages |
| Cross-tenant data access              | Conversation orchestrator only accesses data for the specific seeker-posting pair       |
| Agent fabrication                     | System prompt guardrails + output validation                                            |
| Discrimination in evaluation          | Anti-discrimination system prompt (extends Feature 5 pattern)                           |
| Runaway costs                         | Max turn limit (default 10), concurrent conversation limit (50 per posting)             |

---

## Performance Strategy

| Requirement                      | Approach                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| 15s per turn                     | Single `generateObject` call per turn; typical LLM response < 10s          |
| 5 min per 10-turn conversation   | Each step is independent; parallelism at the posting level, not turn level |
| 50 concurrent conversations      | Inngest concurrency control with `jobPostingId` key                        |
| No interference between postings | Each posting's conversations are independent Inngest function runs         |

---

## Testing Strategy

| Layer       | What                          | How                                                             |
| ----------- | ----------------------------- | --------------------------------------------------------------- |
| Unit        | Privacy filter                | Direct function tests with known private values                 |
| Unit        | Conversation schemas          | Zod parse/reject tests                                          |
| Unit        | Seeker agent prompt builder   | Verify prompt includes correct context, excludes private values |
| Unit        | Orchestrator turn logic       | Mock both agents, verify phase progression and termination      |
| Unit        | Match decision protocol       | Mock agent decisions, verify MATCH/NO_MATCH outcomes            |
| Integration | Inngest workflow              | Mock step runner + mock agents, verify full conversation flow   |
| Integration | evaluate-candidates branching | Flag ON → dispatches events; flag OFF → direct matches          |
| E2E         | Full conversation (stubs)     | Gated behind E2E flag; verify conversation creates Match        |

All LLM calls mocked with deterministic responses. No real API calls in tests.

---

## Constitutional Compliance

- [x] **Type Safety First (I)** — Zod schemas for all agent output, message shapes, decisions
- [x] **Test-Driven Development (II)** — TDD enforced; all agent calls mocked
- [x] **BYOK Architecture (III)** — Both agents use their owner's BYOK key; no platform keys
- [x] **Minimal Abstractions (IV)** — Vercel AI SDK `generateObject()` + direct orchestration; no LangChain
- [x] **Security & Privacy (V)** — Privacy filter, server-side-only prompt construction, no private value storage
- [x] **Phased Rollout (VI)** — `AGENT_CONVERSATIONS` feature flag gates the new behavior
- [x] **Agent Autonomy (VII)** — No human intervention during conversation; matches surfaced only on consensus

---

## Risks & Mitigation

| Risk                                                  | Impact                                 | Mitigation                                                                              |
| ----------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| LLM produces incoherent multi-turn dialogue           | Poor match quality                     | Structured phases + detailed system prompts per phase                                   |
| Privacy filter false positives (blocks valid content) | Conversations terminated unnecessarily | Filter targets only exact private param values, not all numbers                         |
| BYOK key cost surprise for seekers                    | User churn                             | Max turn limit + per-conversation LLM call count logging                                |
| Inngest step limits                                   | Workflow failures                      | 10-turn max = 21 steps max (1 setup + 10 turns \* 2 agents), well within Inngest limits |
| Feature 5 regression when flag toggled                | Broken matching                        | Comprehensive test coverage for both flag states                                        |
