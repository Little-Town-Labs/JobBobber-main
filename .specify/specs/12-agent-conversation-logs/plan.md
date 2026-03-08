# Implementation Plan: Feature 12 — Agent Conversation Logs

## Executive Summary

Add read-only conversation log viewing to both seeker and employer dashboards, with sensitive data redaction and a data usage opt-out preference. Leverages the existing `AgentConversation` model and established tRPC/cursor-pagination patterns.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Dashboard                   │
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │ Seeker Log View  │ │ Employer Log View│  │
│  └────────┬─────────┘ └────────┬─────────┘  │
│           │                     │            │
│  ┌────────▼─────────────────────▼─────────┐  │
│  │      tRPC conversations router         │  │
│  │  (listForSeeker, listForEmployer,      │  │
│  │   getById)                             │  │
│  └────────┬───────────────────────────────┘  │
│           │                                  │
│  ┌────────▼───────────────────────────────┐  │
│  │    Redaction Layer (redactMessage)     │  │
│  │  - Strip evaluation field              │  │
│  │  - Regex dollar amounts → [REDACTED]   │  │
│  └────────┬───────────────────────────────┘  │
│           │                                  │
│  ┌────────▼───────────────────────────────┐  │
│  │    Prisma (AgentConversation model)    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Technology Stack

All existing — no new dependencies required.

| Layer        | Technology          | Rationale                              |
| ------------ | ------------------- | -------------------------------------- |
| API          | tRPC                | Existing pattern, type-safe end-to-end |
| Database     | Prisma + PostgreSQL | AgentConversation model already exists |
| Validation   | Zod                 | Constitutional requirement (Article I) |
| Frontend     | React + Tailwind    | Existing dashboard stack               |
| Feature Flag | Vercel Flags        | Existing flag infrastructure           |

## Technical Decisions

### TD-1: Display-Time Redaction (vs Storage-Time)

**Context:** Spec says redact at storage time, but agents need raw data for multi-turn reasoning.

**Chosen:** Display-time redaction via tRPC response mapper.

**Rationale:** Storage-time redaction would break the conversation workflow — agents need exact salary figures to negotiate. Authorization scoping ensures only the owning user sees logs. Redaction applied consistently in the API layer before data reaches clients.

**Tradeoffs:** Raw data exists in DB (acceptable — DB access is restricted, authorization enforced at API layer).

### TD-2: Redaction Approach

**Chosen:** Two-layer redaction:

1. **Field stripping** — Remove `evaluation` and `decision` fields from response
2. **Content regex** — Replace `$X,XXX`, `$XXk`, percentage patterns in `content` with `[REDACTED]`

**Rationale:** `evaluation` contains structured scores that must never be shown. Dollar amounts in free text are the primary sensitive content. Regex handles common salary/budget patterns.

### TD-3: Data Usage Opt-Out Field Placement

**Chosen:** Add `dataUsageOptOut Boolean @default(false)` to `SeekerSettings` and `Employer` models.

**Rationale:** Colocated with existing per-user preferences. Simple, queryable, type-safe.

### TD-4: New Router vs Extending Existing

**Chosen:** New `conversations` tRPC router.

**Rationale:** Separation of concerns. Conversation logs are read-only and distinct from match actions.

## Implementation Phases

### Phase 1: Foundation (Schema + Redaction)

- Prisma migration: add `dataUsageOptOut` to SeekerSettings and Employer
- Create `redactMessage()` utility with regex patterns
- Create `CONVERSATION_LOGS` feature flag
- Tests for redaction logic

### Phase 2: API Layer (tRPC Router)

- `conversations.listForSeeker` — cursor pagination, status filter
- `conversations.listForEmployer` — cursor pagination, jobPostingId filter
- `conversations.getById` — full conversation with redacted messages
- `settings.updateDataUsageOptOut` — toggle preference
- Authorization: seekerProcedure/employerProcedure ownership checks

### Phase 3: Frontend (Dashboard Components)

- `ConversationList` component — paginated list with status badges
- `ConversationDetail` component — message timeline view
- Seeker dashboard integration at `/conversations`
- Employer dashboard integration at `/dashboard/conversations`
- Empty states, loading skeletons, error handling
- Data usage opt-out toggle in settings pages

### Phase 4: Integration & Polish

- Feature flag gating on all routes
- Accessibility audit (keyboard nav, screen reader)
- Performance validation (< 500ms list, < 300ms detail)

## Security Considerations

| Threat                     | Mitigation                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| Cross-user data access     | Authorization scoping via seekerProcedure/employerProcedure + ownership checks |
| Sensitive data leakage     | Display-time redaction strips evaluations + dollar amounts                     |
| Evaluation scores exposure | `evaluation` and `decision` fields excluded from API response type             |
| IDOR on conversationId     | Verify conversation.seekerId === ctx.seeker.id (or posting.employerId)         |

## Performance Strategy

- Cursor pagination (limit 20 default) — no offset queries
- Existing indexes on `seekerId`, `jobPostingId`, `status` cover all query patterns
- Message array loaded in single query (JSON column, no joins)
- No additional indexes needed

## Testing Strategy

- **Unit tests:** `redactMessage()` with various input patterns (dollar amounts, percentages, evaluations)
- **Integration tests:** tRPC router authorization (seeker can't see other seeker's logs, employer scoped to own postings)
- **Component tests:** ConversationList pagination, ConversationDetail message rendering, empty/error states
- **Coverage target:** 80%+

## Risks & Mitigation

| Risk                             | Probability | Impact | Mitigation                                              |
| -------------------------------- | ----------- | ------ | ------------------------------------------------------- |
| Regex misses sensitive patterns  | Medium      | Medium | Comprehensive test suite + allowlist response shape     |
| Large conversations slow to load | Low         | Low    | Conversations capped at ~50 messages by workflow design |
| Opt-out retroactivity confusion  | Low         | Medium | Clear UI copy: "applies to future conversations"        |

## Constitutional Compliance

- [x] **Article I: Type Safety** — Zod schemas for all inputs, typed response mappers
- [x] **Article II: TDD** — Tests first for redaction, router, components
- [x] **Article III: Security & Privacy** — Evaluation scores never exposed, dollar amounts redacted
- [x] **Article IV: BYOK** — No BYOK impact (read-only feature)
- [x] **Article V: Phased Rollout** — Behind `CONVERSATION_LOGS` feature flag
