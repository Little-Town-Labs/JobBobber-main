# Implementation Plan: Feature 14 — Aggregate Feedback Insights

**Branch:** 14-aggregate-feedback-insights
**Specification:** .specify/specs/14-aggregate-feedback-insights/spec.md
**Status:** Ready for task breakdown

---

## Executive Summary

Implement AI-generated feedback insights that help job seekers and employers improve their outcomes. The system aggregates conversation data into anonymized statistics, feeds them to an LLM via the user's BYOK key, and stores structured insights (strengths, weaknesses, recommendations) with trend tracking. An Inngest workflow handles background generation. The existing stub `insightsRouter` and `FeedbackInsights` model are completed with full functionality.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Dashboard UI                                        │
│  ├─ SeekerInsightsPanel (seeker dashboard)          │
│  └─ EmployerInsightsPanel (employer dashboard)      │
│      └─ calls insights.getSeekerInsights /           │
│         insights.getEmployerInsights                 │
└──────────────────┬──────────────────────────────────┘
                   │ tRPC
┌──────────────────▼──────────────────────────────────┐
│  insights router (tRPC)                              │
│  ├─ getSeekerInsights  (seekerProcedure)            │
│  ├─ getEmployerInsights (employerProcedure)         │
│  └─ refreshInsights    (protectedProcedure)         │
│      └─ sends Inngest event: insights/refresh        │
└──────────────────┬──────────────────────────────────┘
                   │ Inngest event
┌──────────────────▼──────────────────────────────────┐
│  generate-feedback-insights (Inngest function)       │
│  Step 1: Aggregate conversation statistics           │
│  Step 2: Build anonymized pattern summary            │
│  Step 3: Resolve BYOK key                           │
│  Step 4: Call LLM with Zod structured output        │
│  Step 5: Upsert FeedbackInsights record             │
└─────────────────────────────────────────────────────┘
```

### Event-Driven Regeneration Trigger

When `runAgentConversation` completes (conversation reaches terminal status), it emits:

```
insights/conversation.completed → { userId, userType }
```

A lightweight Inngest function checks if the delta since last generation meets the threshold (3 new conversations), then dispatches `insights/generate` if so.

---

## Technical Decisions

### TD-1: Structured Output via Vercel AI SDK

**Context:** How to get reliable structured insights from LLM.
**Chosen:** `generateObject()` from Vercel AI SDK with Zod schema.
**Rationale:** Already used in `evaluateCandidate`. Ensures type-safe, validated output.
**Alternatives:** Raw text parsing (fragile), function calling (more complex).

### TD-2: Aggregation Before LLM Call

**Context:** Privacy boundary enforcement.
**Chosen:** Compute all aggregates in a dedicated `buildInsightContext()` function that returns only anonymized statistics. The LLM never sees raw data.
**Rationale:** Spec FR-6 requires privacy enforcement at data-gathering layer. Separating aggregation makes it testable independently.

### TD-3: Metrics-Only Fallback for No BYOK Key

**Context:** What to show users without a configured BYOK key.
**Chosen:** Return metrics (counts, rates, trend) without AI-generated text fields. UI shows metrics with a prompt to configure BYOK for full insights.
**Rationale:** Constitutional Article III prohibits platform keys. Metrics are computed locally, no LLM needed.

### TD-4: Reuse Existing insightsRouter Stub

**Context:** There's already a registered `insightsRouter` with TODO stubs.
**Chosen:** Replace stub implementations with full logic. No need to create new router or modify root.ts.
**Rationale:** Clean upgrade path. Router name and registration already in place.

---

## Implementation Phases

### Phase 1: Schema & Flag (Foundation)

- Add `lastInsightConversationCount` field to `FeedbackInsights` model
- Run Prisma migration
- Update `FEEDBACK_INSIGHTS` flag description (already exists in flags.ts)

### Phase 2: Aggregation Engine (Core Logic)

- Create `src/server/insights/aggregate-stats.ts` — builds anonymized statistics from conversations and matches
- Create `src/server/insights/insight-schemas.ts` — Zod schemas for LLM input/output
- Create `src/server/insights/generate-insights.ts` — LLM call with structured output
- All functions pure and testable with mocked DB data

### Phase 3: Inngest Workflow (Background Processing)

- Create `src/server/inngest/functions/generate-feedback-insights.ts`
  - Event: `insights/generate`
  - Steps: aggregate → resolve BYOK → call LLM → upsert record
- Create `src/server/inngest/functions/check-insight-threshold.ts`
  - Event: `insights/conversation.completed`
  - Checks delta, dispatches `insights/generate` if threshold met
- Register both in Inngest function index
- Add event emission to `runAgentConversation` completion path

### Phase 4: tRPC Router (API Layer)

- Replace `insightsRouter` stub with full implementation:
  - `getSeekerInsights` — query FeedbackInsights for seeker, include threshold progress
  - `getEmployerInsights` — query for employer, optional posting scope
  - `refreshInsights` — rate-limited manual trigger, sends Inngest event
- All procedures gated with `assertFlagEnabled(FEEDBACK_INSIGHTS)`

### Phase 5: Dashboard UI (Frontend)

- Create `src/components/insights/insights-panel.tsx` — shared insight display component
- Add insights section to seeker dashboard page
- Add insights section to employer dashboard page
- Empty state with threshold progress
- Stale indicator (>30 days old)
- Manual refresh button with loading state

### Phase 6: Integration & Quality

- Integration tests for full flow (aggregate → generate → store → query)
- Privacy boundary tests (verify no raw data in LLM prompt)
- Rate limiting tests for manual refresh
- Edge case tests (no BYOK, below threshold, concurrent generation)
- UI component tests

---

## Security Considerations

1. **Privacy boundary**: Aggregation function is the single point of control. All tests verify no raw messages, names, or private params in output.
2. **BYOK enforcement**: No fallback keys. Users without BYOK get metrics only.
3. **Rate limiting**: Manual refresh capped at 1/hour per user. Prevents abuse of BYOK key usage.
4. **Authorization**: `seekerProcedure` and `employerProcedure` ensure users only see their own insights.
5. **Output validation**: Zod schema rejects malformed LLM output before storage.

---

## Performance Strategy

1. **Pre-computed metrics**: Insights stored and served from DB. No on-demand LLM calls for reads.
2. **Bounded aggregation**: Pattern analysis limited to last 50 conversations for high-volume users.
3. **Async generation**: All LLM work runs in Inngest, not in request path.
4. **Deduplication**: Concurrent generation requests are idempotent (upsert on unique constraint).

---

## Testing Strategy

1. **Unit tests**: Aggregation functions, schema validation, trend calculation
2. **Integration tests**: Inngest function with mocked LLM, router procedures with mocked DB
3. **Privacy tests**: Dedicated test suite verifying aggregation output contains no PII
4. **UI tests**: Component rendering for all states (loading, empty, below threshold, full insights, stale, no BYOK)
5. **All LLM calls mocked** — deterministic responses via Vitest mocks

---

## Deployment Strategy

1. Deploy behind existing `FEEDBACK_INSIGHTS` flag (already OFF)
2. Enable for internal testing
3. Gradual rollout per constitutional Article VI

---

## Risks & Mitigation

| Risk                                        | Mitigation                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| LLM generates unhelpful or generic insights | Craft specific prompt with concrete statistics; include few-shot examples in prompt           |
| Privacy leak through LLM hallucination      | Enforce at data layer (aggregation), not just prompt; test that raw data never reaches LLM    |
| BYOK key costs for insight generation       | Single LLM call per regeneration; regeneration only on threshold; rate-limited manual refresh |
| Stale insights for inactive users           | Show "last updated" timestamp; visual staleness indicator at 30 days                          |
| Concurrent regeneration race condition      | Upsert on unique constraint; Inngest idempotency key                                          |

---

## Constitutional Compliance

- [x] Type Safety First (I) — Zod schemas for all LLM output, tRPC type-safe procedures
- [x] Test-Driven Development (II) — TDD workflow for all phases
- [x] BYOK Architecture (III) — User's own key; no platform fallback; metrics-only for keyless users
- [x] Minimal Abstractions (IV) — Direct Vercel AI SDK + Inngest; no heavy frameworks
- [x] Security & Privacy (V) — Privacy boundary at aggregation layer; authorization on all endpoints
- [x] Phased Rollout (VI) — Behind FEEDBACK_INSIGHTS feature flag
- [x] Agent Autonomy (VII) — N/A (insights are passive, not agent-driven)
