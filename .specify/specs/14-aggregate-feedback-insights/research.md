# Technology Research

## Decision 1: Insight Generation Approach

**Context:** How to generate structured insights from aggregate conversation data.

**Options Considered:**

1. **Direct LLM call with Zod structured output** — Use Vercel AI SDK `generateObject()` with user's BYOK key and a Zod schema for the output
2. **Rule-based heuristics** — Compute insights purely from statistics (no AI)
3. **Hybrid** — Use statistics for metrics/trends, LLM for natural language strengths/weaknesses/recommendations

**Chosen:** Option 1 — Direct LLM with Zod structured output
**Rationale:** Aligns with existing codebase patterns (see `evaluateCandidate` in employer-agent). Zod validation already established. BYOK model requires user's key. Rule-based can't produce nuanced, personalized recommendations. The FeedbackInsights model already has `strengths`, `weaknesses`, `recommendations` fields designed for AI-generated text.
**Tradeoffs:** Requires BYOK key; users without a key can't get insights. LLM output quality varies.

## Decision 2: Aggregation Data Strategy

**Context:** What data to feed the LLM for insight generation while maintaining privacy.

**Options Considered:**

1. **Raw conversation messages** — Pass full messages to LLM for analysis
2. **Aggregate statistics only** — Pass only counts, rates, and distributions
3. **Anonymized pattern summaries** — Compute pattern summaries (e.g., "3 of 5 conversations cited skills gap") without individual details

**Chosen:** Option 3 — Anonymized pattern summaries
**Rationale:** Option 1 violates privacy requirements (spec FR-6). Option 2 is too sparse for useful recommendations. Option 3 provides enough signal for actionable insights while enforcing privacy at the data layer. Pattern summaries computed server-side before LLM call.
**Tradeoffs:** More complex aggregation logic, but privacy boundary is enforced structurally.

## Decision 3: Regeneration Trigger

**Context:** When to regenerate insights.

**Options Considered:**

1. **Cron schedule** — Regenerate for all users on a fixed schedule (daily/weekly)
2. **Event-driven** — Regenerate after N new completed conversations per user
3. **On-demand only** — User manually triggers

**Chosen:** Option 2 — Event-driven (with manual refresh option)
**Rationale:** Cron is wasteful for users with no new data and adds latency for active users. Event-driven aligns with Inngest patterns already used throughout the codebase. Manual refresh (rate-limited) as supplement per spec FR-5.
**Tradeoffs:** Requires tracking conversation count since last generation.

## Decision 4: BYOK Key Resolution for Insights

**Context:** Which BYOK key to use for insight generation — seekers and employers both have their own keys.

**Options Considered:**

1. **Use the user's own BYOK key** — Seeker insights use seeker's key, employer insights use employer's key
2. **Use a platform key for insights** — Separate from matching
3. **Skip LLM for users without BYOK key** — Show metrics only

**Chosen:** Option 1 — Use the user's own BYOK key
**Rationale:** Constitutional requirement (Article III: BYOK). Users who haven't configured a key see metrics only (no AI-generated text insights). This is consistent with how all other AI features work in the codebase.
**Tradeoffs:** Users without keys get degraded experience. Acceptable given constitutional mandate.
