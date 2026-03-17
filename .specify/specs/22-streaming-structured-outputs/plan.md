# Implementation Plan — 22-streaming-structured-outputs

**Specification:** `.specify/specs/22-streaming-structured-outputs/spec.md`
**Created:** 2026-03-17
**Dependencies:** Feature 19 (complete). Independent of Features 20/21.

---

## Executive Summary

Add progressive rendering for structured agent responses in the chat UI.
When the LLM generates multi-field structured outputs (match evaluations,
profile summaries), fields render one-by-one as they stream instead of
appearing all at once after the full response completes.

**This is a frontend-only feature.** The backend already streams via
`streamText()` — this plan adds a client-side parser that identifies
structured content in the text stream and renders fields progressively.

---

## Architecture

The AI SDK already streams text token-by-token. Structured responses arrive
as formatted text (markdown or JSON-like sections). The progressive renderer
intercepts the streaming text, detects structure patterns, and renders
individual fields as they become complete.

```
Token stream from LLM
  │
  ▼
StreamingStructuredParser (client-side)
  ├─ Detects section headers / field boundaries
  ├─ Emits field-complete events as each field finishes
  └─ Returns remaining partial content for live rendering

ProgressiveFieldRenderer
  ├─ Complete fields: render fully styled
  ├─ In-progress field: render with typing indicator
  └─ Pending fields: render as skeleton placeholders
```

**Key insight:** We don't need `streamObject` (which requires schema-aware
streaming from the backend). Instead, we parse the text stream on the client
and detect field boundaries in the LLM's natural text output. This avoids
backend changes entirely.

---

## Implementation Phases

### Phase 1: Streaming Parser

**File to create:** `src/components/chat/streaming-parser.ts`

- Detect section patterns in streaming text (e.g., `**Confidence:**`, `**Strengths:**`, `### `)
- Track field states: pending → streaming → complete
- Export a `useStreamingFields(text: string)` hook that returns:
  ```typescript
  {
    fields: Array<{ name: string; content: string; state: "pending" | "streaming" | "complete" }>
  }
  ```

### Phase 2: Progressive Renderer

**File to create:** `src/components/chat/progressive-fields.tsx`

- Receives fields from the parser hook
- Complete fields: fully styled with section header
- Streaming field: content visible + blinking cursor
- Pending fields: skeleton placeholder (animated)
- Fallback: if no structure detected, render as plain streaming text (existing behavior)

### Phase 3: ChatInterface Integration

**File to modify:** `src/components/chat/chat-interface.tsx`

- For assistant messages with `status === 'streaming'`, wrap content in progressive renderer
- For completed messages, render normally (no progressive animation)
- Error handling: if stream fails mid-field, preserve completed fields + show error

### Phase 4: Tests

**Files to create:**

- `src/components/chat/streaming-parser.test.ts` — parser unit tests
- `tests/unit/components/chat/progressive-fields.test.tsx` — renderer tests

---

## Constitutional Compliance

- [x] **Type Safety (I):** Parser and renderer fully typed
- [x] **TDD (II):** Parser tests + renderer tests
- [x] **Minimal Abstractions (IV):** No new libraries — plain string parsing + React
- [x] **Feature Flags (VI):** No separate flag — uses `USER_CHAT`

---

## File Inventory

| File                                                     | Action | Purpose                         |
| -------------------------------------------------------- | ------ | ------------------------------- |
| `src/components/chat/streaming-parser.ts`                | Create | Text stream → field parser      |
| `src/components/chat/streaming-parser.test.ts`           | Create | Parser unit tests               |
| `src/components/chat/progressive-fields.tsx`             | Create | Progressive field renderer      |
| `tests/unit/components/chat/progressive-fields.test.tsx` | Create | Renderer tests                  |
| `src/components/chat/chat-interface.tsx`                 | Modify | Integrate progressive rendering |

**Estimated effort:** 6 hours
