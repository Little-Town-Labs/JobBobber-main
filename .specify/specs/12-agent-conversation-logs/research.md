# Technology Research

## Decision: Redaction Strategy

**Context:** Spec requires sensitive data (salary figures, private negotiation parameters) to be redacted from conversation logs.

**Options Considered:**

1. **Storage-time redaction** — Redact before persisting messages to `AgentConversation.messages[]`
2. **Display-time redaction** — Store raw messages, redact on read via response mapper
3. **Dual-column storage** — Store both raw and redacted versions

**Chosen:** Option 2 — Display-time redaction

**Rationale:** The spec says "redaction occurs at storage time" but the codebase already stores messages via Inngest workflows (`run-agent-conversation.ts`) and the existing `privacy-filter.ts` module provides filtering logic. Implementing storage-time redaction would require modifying the conversation workflow which is Feature 9's domain. Instead, we create a `redactMessage()` utility applied in the tRPC response mapper, ensuring raw data is never sent to clients. The stored messages remain intact for internal agent reasoning in future turns.

**Tradeoffs:** Raw sensitive data exists in DB (mitigated by authorization scoping + DB-level access controls). Simpler implementation, no workflow changes needed.

**Update:** After further consideration, display-time redaction is the pragmatic choice because:

- Agents NEED the raw data for multi-turn reasoning
- Redacting at storage time would break the conversation workflow
- Authorization ensures only the owning user sees their logs
- The redaction function produces the same output regardless of when it runs

## Decision: Data Usage Opt-Out Storage

**Context:** Users need a preference for opting out of conversation data being used for model improvement.

**Options Considered:**

1. **Add field to SeekerSettings / Employer models** — Colocated with existing preferences
2. **Separate UserPreferences table** — More extensible but adds complexity
3. **JSON field on existing user models** — Flexible but untyped

**Chosen:** Option 1 — Add `dataUsageOptOut Boolean @default(false)` to SeekerSettings and Employer models

**Rationale:** Follows existing pattern (settings are already per-user). Simple, type-safe, queryable. No new tables needed.

## Decision: Conversation Log API Design

**Context:** Need API endpoints for listing and viewing conversation logs.

**Options Considered:**

1. **New `conversations` tRPC router** — Dedicated router for log-related endpoints
2. **Extend existing `matches` router** — Conversations are related to matches
3. **Add to `seekers` and `employers` routers** — Role-specific endpoints

**Chosen:** Option 1 — New `conversations` tRPC router

**Rationale:** Separation of concerns. Conversation logs are a distinct domain from matching. Follows existing pattern where each domain has its own router (matches, jobPostings, settings).

## Decision: Redaction Implementation

**Context:** Need to identify and redact sensitive content in conversation messages.

**Options Considered:**

1. **Regex-based redaction** — Pattern match salary figures, dollar amounts, percentages
2. **Field-based redaction** — Strip `evaluation` field which contains scores/reasoning
3. **Allowlist approach** — Only expose `role`, `content` (redacted), `phase`, `timestamp`, `turnNumber`

**Chosen:** Combined approach — Field-based (strip evaluations) + regex for dollar amounts in content

**Rationale:** The `evaluation` field contains structured scoring data that should never be shown to users. Dollar amounts in free-text `content` need regex redaction. Phase and turn metadata are safe to expose.
