# Technology Research: Two-Way Matching

## Decision 1: Structured Evaluation Schema Approach

**Context:** Feature 10 needs agents to produce structured, dimension-level evaluations instead of just MATCH/NO_MATCH signals. How should this structured output be collected?

**Options Considered:**

1. **Extend AgentTurnOutput** — Add optional `evaluation` field to the existing turn output schema, collected on the final decision turn only.
2. **Separate evaluation step** — After the conversation ends, run a separate LLM call per agent to produce a structured evaluation of the full conversation.
3. **Accumulate per-turn scores** — Each turn includes dimension scores that accumulate across the conversation.

**Chosen:** Option 1 — Extend AgentTurnOutput with optional evaluation on decision turns

**Rationale:**

- Minimal disruption to existing conversation flow (Feature 9 code)
- No extra LLM calls (cost-neutral)
- Evaluation is naturally produced alongside the MATCH/NO_MATCH decision
- The agent already has full conversation context at decision time
- Option 2 doubles LLM costs; Option 3 adds complexity to every turn

**Tradeoffs:** Evaluation is only produced on the final turn, not accumulated. This is acceptable because the agent sees the full conversation history when making its decision.

---

## Decision 2: Confidence Scoring Algorithm

**Context:** Current confidence scoring is based solely on conversation length (≤4 turns = STRONG, ≤7 = GOOD, else POTENTIAL). Feature 10 requires scoring based on evaluation depth.

**Options Considered:**

1. **Average dimension scores** — Compute an unweighted mean of both agents' dimension scores, map to confidence tiers.
2. **Minimum dimension approach** — Confidence limited by the weakest alignment dimension.
3. **LLM-generated confidence** — Let the agent self-report confidence level.

**Chosen:** Option 1 — Unweighted mean of dimension scores from both agents

**Rationale:**

- Deterministic given the same inputs (FR-011)
- Transparent — users can understand how it was derived
- Balanced — considers overall alignment, not just the weakest point
- Option 2 is too pessimistic (one weak dimension tanks the whole score)
- Option 3 is non-deterministic and hard to calibrate

**Tradeoffs:** Doesn't penalize a single critical weakness as strongly as Option 2. Acceptable because deal-breakers are handled via NO_MATCH signals before evaluation scoring.

---

## Decision 3: Match Summary Generation

**Context:** Current match summary is last 4 messages concatenated. Feature 10 needs both-sided summaries.

**Options Considered:**

1. **Extract from evaluation data** — Use the `reasoning` fields from each agent's evaluation to form employer/seeker summaries.
2. **Additional LLM call** — Run a summary generation call using the full conversation.
3. **Template-based** — Fill in a template using dimension scores and agent evaluation text.

**Chosen:** Option 1 — Extract from agent evaluation reasoning fields

**Rationale:**

- Zero additional LLM calls
- Each agent already produces reasoning text as part of its evaluation
- Naturally gives both-sided perspective
- Privacy-safe (agent reasoning already follows privacy rules)

**Tradeoffs:** Summary quality depends on agent evaluation output quality. Mitigated by Zod validation requiring minimum reasoning length.

---

## Decision 4: Schema Migration Strategy

**Context:** Match model needs new fields (evaluationData, employerSummary, seekerSummary). Existing matches from Feature 9 don't have this data.

**Options Considered:**

1. **Add nullable fields** — New fields are optional, old matches have null values.
2. **Add with defaults** — New fields have default empty values.

**Chosen:** Option 1 — Nullable fields

**Rationale:**

- Honest representation — old matches genuinely don't have evaluation data
- No fake data for historical records
- UI can gracefully handle missing evaluation data with a "Evaluated before two-way matching" note

**Tradeoffs:** UI must handle null evaluation data. Acceptable since the dashboard already exists and can conditionally render.
