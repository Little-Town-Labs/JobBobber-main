# Implementation Plan: Two-Way Matching

**Feature:** 10-two-way-matching
**Specification:** `.specify/specs/10-two-way-matching/spec.md`
**Created:** 2026-03-07
**Status:** Ready for tasks

---

## Executive Summary

Feature 10 upgrades the agent-to-agent conversation system to enforce bidirectional consensus matching with structured evaluations. The core changes are:

1. **Extend agent turn output** — Add optional structured evaluation schema to AgentTurnOutput, produced on decision turns
2. **Upgrade seeker agent** — Enhance the Job Seeker Agent to proactively evaluate opportunities against private preferences with dimension scoring
3. **Replace confidence scoring** — Replace naive message-count-based scoring with dimension-score-weighted algorithm
4. **Extend Match model** — Add `employerSummary`, `seekerSummary`, and `evaluationData` fields
5. **Update match creation** — Extract evaluation data from final decision turns and compute confidence from dimension scores

The existing conversation infrastructure (Feature 9) is preserved. This is an enhancement, not a rewrite.

---

## Architecture Overview

```
Conversation Flow (Feature 9, unchanged):
  Inngest run-agent-conversation
    → turn loop (alternating employer/seeker agents)
    → shouldTerminate() checks decisions
    → finalize step

Feature 10 additions:
  Agent Turn (decision phase):
    → agent produces AgentTurnOutput WITH evaluation field
    → evaluation validated by extended Zod schema
    → evaluation stored on message (decision turns only)

  Match Creation (finalize step):
    → extract employer evaluation from last employer_agent message
    → extract seeker evaluation from last seeker_agent message
    → compute confidence from dimension scores
    → generate per-perspective summaries from evaluation reasoning
    → store Match with evaluationData, employerSummary, seekerSummary
```

No new Inngest functions. No new API routes. No new database tables. This feature modifies existing schemas and logic.

---

## Technology Stack

All decisions use the locked stack from the constitution. No new dependencies.

| Component              | Technology                     | Rationale                                                      |
| ---------------------- | ------------------------------ | -------------------------------------------------------------- |
| Evaluation schema      | Zod                            | Constitutional requirement (I) — all agent output validated    |
| DB storage             | Prisma Json field              | Evaluation data is agent-generated JSON, fits existing pattern |
| LLM structured output  | Vercel AI SDK `generateObject` | Already used by both agents                                    |
| Confidence computation | Pure TypeScript function       | Deterministic, testable, no library needed                     |

---

## Technical Decisions

### TD-1: Evaluation on Decision Turns Only

**Context:** When should agents produce structured evaluations?
**Chosen:** Only on the turn where the agent signals MATCH or NO_MATCH (decision turns)
**Rationale:** Avoids extra LLM calls, avoids schema complexity on non-decision turns
**Impact:** `agentTurnOutputSchema` gets an optional `evaluation` field; validation enforces it when `decision !== "CONTINUE"`

### TD-2: Single Extended Schema vs Separate Schema

**Context:** Should we create a new schema or extend the existing one?
**Chosen:** Extend `agentTurnOutputSchema` with optional `evaluation` field
**Rationale:** Backwards-compatible — CONTINUE turns still produce the same output. Only decision turns add the evaluation. Avoids duplicating the entire turn output type.

### TD-3: Confidence from Dimension Averages

**Context:** How to derive confidence levels deterministically?
**Chosen:** Average all dimension scores from both evaluations, map to tiers (>=75 STRONG, >=55 GOOD, >=35 POTENTIAL)
**Rationale:** Deterministic (FR-011), transparent, and balanced. Deal-breakers already handled by NO_MATCH signals — confidence scoring only applies to mutual matches.

### TD-4: Dashboard Filtering of No-Match Conversations

**Context:** FR-008 requires COMPLETED_NO_MATCH conversations not appear in dashboards.
**Chosen:** Add `where` clause to existing match query in matches router — filter by conversation status. No-match conversations already have no Match record, so they don't appear in match lists. For the employer candidate list, add a filter excluding seekers who only have no-match conversations for that posting.
**Rationale:** Minimal change to existing queries. The matches router already filters by match status.

---

## Implementation Phases

### Phase 1: Schema & Types (Foundation)

**Files modified:**

- `src/lib/conversation-schemas.ts` — Add `agentDimensionScoreSchema`, `agentEvaluationSchema`, extend `agentTurnOutputSchema`
- `src/lib/matching-schemas.ts` — Add `matchEvaluationDataSchema`, `computeConfidence()` function
- `prisma/schema.prisma` — Add nullable fields to Match model

**Key changes:**

- New Zod schemas for dimension scores and agent evaluations
- `agentTurnOutputSchema` extended with optional `evaluation` field
- Validation rule: evaluation required when decision is MATCH or NO_MATCH
- `computeConfidence()` — pure function: evaluation data in, confidence level out
- Prisma migration: `employerSummary`, `seekerSummary`, `evaluationData` on Match

### Phase 2: Agent Enhancement

**Files modified:**

- `src/server/agents/seeker-agent.ts` — Enhanced system prompt and schema
- `src/server/agents/employer-agent.ts` — Enhanced system prompt and schema

**Key changes:**

- Both agents' system prompts updated for decision phase: "When making your final decision, provide structured evaluation with dimension scores"
- Both agents use the extended `agentTurnOutputSchema` (with optional evaluation)
- Seeker agent prompt enhanced to proactively evaluate against private preferences:
  - Check compensation alignment against minSalary
  - Check work arrangement against deal-breakers
  - Weight evaluation by priority ranking
- Employer agent prompt enhanced to score candidate dimensions

### Phase 3: Match Creation Upgrade

**Files modified:**

- `src/server/inngest/functions/run-agent-conversation.ts` — Finalize step upgraded

**Key changes:**

- Extract evaluations from final employer/seeker decision messages
- Call `computeConfidence()` with combined evaluations
- Generate `employerSummary` from employer evaluation reasoning
- Generate `seekerSummary` from seeker evaluation reasoning
- Create Match with all new fields populated
- Replace old message-count confidence logic

### Phase 4: Dashboard Filtering

**Files modified:**

- `src/server/api/routers/matches.ts` — Ensure no-match conversations don't leak

**Key changes:**

- Verify existing match queries already exclude no-match conversations (they should — no Match record exists for no-match)
- Add explicit filter if any employer candidate listing shows seekers with only no-match conversations
- Ensure match detail view gracefully handles null evaluationData (old matches)

### Phase 5: Privacy & Guardrails

**Files modified:**

- `src/server/agents/privacy-filter.ts` — Verify evaluation reasoning is filtered
- Test suite additions

**Key changes:**

- Ensure privacy filter runs on evaluation reasoning text (not just message content)
- Add tests verifying no private values appear in evaluation reasoning or match summaries
- Add tests verifying silent no-match (no notifications, no dashboard visibility)

---

## Security Considerations

| Risk                                   | Mitigation                                                     |
| -------------------------------------- | -------------------------------------------------------------- |
| Private values in evaluation reasoning | Privacy filter applied to evaluation reasoning before storage  |
| Private values in match summaries      | Summaries derived from filtered evaluation reasoning           |
| Cross-tenant evaluation data access    | Existing tRPC authorization on matches router (unchanged)      |
| Malformed LLM evaluation output        | Zod validation rejects invalid evaluations; agent retries once |

---

## Performance Strategy

| Concern                            | Approach                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| Extra LLM output per decision turn | Marginal — evaluation adds ~200 tokens to final turn only |
| Confidence computation             | Pure function, O(n) over dimensions — negligible          |
| Match query performance            | No new queries; existing indexes sufficient               |
| Migration                          | Adding nullable columns — instant, no table rewrite       |

---

## Testing Strategy

### Unit Tests

- `computeConfidence()` — all tier boundaries, edge cases
- `agentEvaluationSchema` validation — valid/invalid inputs
- Privacy filter on evaluation reasoning text
- Confidence derivation determinism (same input = same output)

### Integration Tests

- Full conversation producing mutual MATCH with evaluations
- Full conversation producing NO_MATCH with seeker deal-breaker
- Match creation with correct evaluationData, summaries, confidence
- Old matches (null evaluationData) render correctly
- No-match conversations not visible in dashboard queries

### Mock Strategy

- LLM calls mocked (constitutional requirement)
- Mock agent returns structured evaluations on decision turns
- Mock agent returns NO_MATCH when deal-breakers triggered

---

## Deployment Strategy

1. Database migration (add nullable fields — safe, no downtime)
2. Deploy code behind existing `AGENT_CONVERSATIONS` feature flag
3. New conversations automatically use two-way matching
4. Old matches gracefully degrade (null evaluation data)
5. No separate feature flag needed — this is an enhancement to Feature 9's flag

---

## Risks & Mitigation

| Risk                                     | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Agents produce invalid evaluation JSON   | Medium     | Low    | Zod validation + retry; fallback to basic match (no evaluation data)      |
| Seeker agent ignores private preferences | Low        | Medium | Explicit prompt instructions + test cases verifying deal-breaker behavior |
| Confidence scores poorly calibrated      | Medium     | Low    | Thresholds are configurable constants; adjust based on real data          |
| Migration breaks existing matches        | Low        | High   | All new fields nullable; no changes to existing data                      |

---

## Constitutional Compliance

- [x] **Type Safety First (I)** — All evaluation schemas validated with Zod
- [x] **Test-Driven Development (II)** — TDD for all new functions, 80%+ coverage
- [x] **BYOK Architecture (III)** — No changes to key handling (uses Feature 9 infrastructure)
- [x] **Minimal Abstractions (IV)** — Pure functions for confidence; no new frameworks
- [x] **Security & Privacy (V)** — Privacy filter on evaluations; no private value leakage
- [x] **Phased Rollout (VI)** — Uses existing AGENT_CONVERSATIONS feature flag
- [x] **Agent Autonomy (VII)** — No human intervention; agents make independent decisions
