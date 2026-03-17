# Implementation Plan — 21-advanced-chat-with-tools

**Specification:** `.specify/specs/21-advanced-chat-with-tools/spec.md`
**Created:** 2026-03-17
**Dependencies:** Feature 19 (complete), Feature 20 (agent-tool-calling)

---

## Executive Summary

Upgrade the chat UI to render tool results as structured components instead of
plain text. Job search results become cards, match data becomes tables with badges,
profile data becomes a preview card. Add suggestion buttons after tool results
that send follow-up messages.

**This is a frontend-only feature.** No backend changes, no new API routes, no
new database models. All work is in `src/components/chat/`.

---

## Architecture

The AI SDK's `useChat` hook already receives tool call results as part of the
message stream. The `UIMessage` type has a `parts` array where tool results appear
as `ToolUIPart` entries. This plan adds component renderers that detect tool result
parts and render them as structured UI instead of raw text.

```
UIMessage.parts[]
  ├─ TextUIPart → render as text (existing)
  ├─ ToolUIPart → NEW: detect tool name, render structured component
  │    ├─ searchJobs result → JobSearchResultCards
  │    ├─ getMyMatches result → MatchSummaryTable
  │    ├─ getCandidates result → CandidatePipelineTable
  │    ├─ getMyProfile result → ProfilePreviewCard
  │    └─ other tools → JSON fallback (formatted)
  └─ Other parts → existing rendering
```

---

## Implementation Phases

### Phase 1: Tool Result Components (4 components)

**Files to create in `src/components/chat/`:**

1. **`tool-result-renderer.tsx`** — Dispatcher that maps tool names to components
2. **`job-search-cards.tsx`** — Card grid for `searchJobs` results
3. **`match-summary-table.tsx`** — Table for `getMyMatches`/`getCandidates` results
4. **`profile-preview-card.tsx`** — Card for `getMyProfile` results

Each component:

- Receives the tool result data as props
- Handles missing/null fields (show "—")
- Responsive: tables become stacked cards below 768px
- Uses existing Tailwind + shadcn patterns

### Phase 2: Suggestion Buttons

**File to create:** `src/components/chat/suggestion-buttons.tsx`

- Receives an array of `{ label: string, message: string }` suggestions
- Renders as horizontal button row below tool results
- On click: calls `sendMessage({ text: message })` from the `useChat` hook
- Suggestions determined by tool name:
  - `searchJobs` → "Tell me more about [top result title]"
  - `getMyMatches` → "Accept this match", "Why did we match?"
  - `getCandidates` → "Show me [top candidate]'s profile"

### Phase 3: ChatInterface Integration

**File to modify:** `src/components/chat/chat-interface.tsx`

- Update message rendering loop to detect `ToolUIPart` in message parts
- Pass tool results to `ToolResultRenderer`
- Pass suggestion config to `SuggestionButtons`
- On history reload, tool results render as static (no interactive suggestions)

### Phase 4: Tests

**Files to create/modify:**

- `tests/unit/components/chat/tool-result-renderer.test.tsx`
- `tests/unit/components/chat/suggestion-buttons.test.tsx`
- Update `tests/unit/components/chat/chat-interface.test.tsx`

---

## Constitutional Compliance

- [x] **Type Safety (I):** Props typed, tool result shapes validated
- [x] **TDD (II):** Component tests for all renderers
- [x] **Minimal Abstractions (IV):** Plain React components, no new libraries
- [x] **Feature Flags (VI):** No separate flag — gated by `AGENT_TOOL_CALLING` from Feature 20

---

## File Inventory

| File                                                       | Action | Purpose                          |
| ---------------------------------------------------------- | ------ | -------------------------------- |
| `src/components/chat/tool-result-renderer.tsx`             | Create | Tool name → component dispatcher |
| `src/components/chat/job-search-cards.tsx`                 | Create | Job posting card grid            |
| `src/components/chat/match-summary-table.tsx`              | Create | Match/candidate table            |
| `src/components/chat/profile-preview-card.tsx`             | Create | Profile preview card             |
| `src/components/chat/suggestion-buttons.tsx`               | Create | Post-result action buttons       |
| `src/components/chat/chat-interface.tsx`                   | Modify | Integrate tool result rendering  |
| `tests/unit/components/chat/tool-result-renderer.test.tsx` | Create | Renderer tests                   |
| `tests/unit/components/chat/suggestion-buttons.test.tsx`   | Create | Suggestion tests                 |
| `tests/unit/components/chat/chat-interface.test.tsx`       | Modify | Integration tests                |

**Estimated effort:** 8 hours
